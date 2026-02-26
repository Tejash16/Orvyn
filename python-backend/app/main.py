from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, Session
import os
import datetime

load_dotenv()

app = FastAPI(title="DocRack AI Engine")

# ---------------------------------------------------------------------------
# In-memory engine registry — set by POST /init-db, cleared on app restart.
# All DB-dependent routes must check this before operating.
# ---------------------------------------------------------------------------
active_engine = None

# Accepted theme values — validated before any DB write.
_VALID_THEMES = {"light", "dark"}

# ---------------------------------------------------------------------------
# SQLAlchemy ORM — schema defined and owned exclusively by this Python backend.
# No other layer may create, alter, or drop these tables.
# ---------------------------------------------------------------------------
Base = declarative_base()


class UserMeta(Base):
    __tablename__ = "user_meta"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mongo_user_id = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Settings(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_db():
    """
    Returns active_engine or raises 503 if /init-db has not been called yet.
    Call this at the start of every DB-dependent route.
    """
    if active_engine is None:
        raise HTTPException(
            status_code=503,
            detail="Database not initialised. Call POST /init-db first.",
        )
    return active_engine


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


# ---- Database initialisation -----------------------------------------------

class InitDbRequest(BaseModel):
    database_path: str
    mongo_user_id: str


@app.post("/init-db")
def init_db(request: InitDbRequest):
    global active_engine

    db_path = request.database_path

    # Security: only absolute paths are accepted
    if not os.path.isabs(db_path):
        raise HTTPException(
            status_code=400,
            detail="database_path must be an absolute path",
        )

    # Security: reject any path containing '..' components
    path_obj = Path(db_path)
    if ".." in path_obj.parts:
        raise HTTPException(
            status_code=400,
            detail="Path traversal is not allowed in database_path",
        )

    # Resolve to normalise redundant separators without changing the target
    try:
        resolved = str(path_obj.resolve())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid database_path")

    # Create parent directory if it does not exist
    parent_dir = os.path.dirname(resolved)
    try:
        os.makedirs(parent_dir, exist_ok=True)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not create database directory: {exc}",
        )

    # Create engine and initialise schema — Python owns all DDL
    engine = create_engine(f"sqlite:///{resolved}", echo=False)
    Base.metadata.create_all(engine)

    # Upsert user_meta row — idempotent, one row per mongo_user_id
    with Session(engine) as session:
        existing = (
            session.query(UserMeta)
            .filter_by(mongo_user_id=request.mongo_user_id)
            .first()
        )
        if not existing:
            session.add(UserMeta(mongo_user_id=request.mongo_user_id))
            session.commit()

    # Register engine only after schema + seed succeed
    active_engine = engine

    return {
        "status": "success",
        "message": "Database initialized",
        "path": resolved,
    }


# ---- Theme settings ---------------------------------------------------------

@app.get("/settings/theme")
def get_theme():
    """
    Returns the stored theme for the active user.
    Defaults to "light" if no theme has been persisted yet.
    Requires /init-db to have been called first.
    """
    engine = _require_db()
    with Session(engine) as session:
        row = session.query(Settings).filter_by(key="theme").first()
    return {"theme": row.value if row else "light"}


class ThemeRequest(BaseModel):
    theme: str


@app.post("/settings/theme")
def set_theme(request: ThemeRequest):
    """
    Persists the theme to the settings table.
    Only "light" and "dark" are accepted — all other values are rejected.
    Upserts the existing row so there is never more than one theme entry.
    Requires /init-db to have been called first.
    """
    if request.theme not in _VALID_THEMES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid theme value '{request.theme}'. Allowed: light, dark.",
        )

    engine = _require_db()
    with Session(engine) as session:
        row = session.query(Settings).filter_by(key="theme").first()
        if row:
            row.value = request.theme
        else:
            session.add(Settings(key="theme", value=request.theme))
        session.commit()

    return {"status": "success", "theme": request.theme}

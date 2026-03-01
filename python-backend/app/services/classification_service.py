"""
AI Classification Service — Google Gemini integration for DocRack.

Handles file-to-folder classification and AI-generated DataRoom structures.
All Gemini API calls are isolated here; main.py stays as the route layer.
"""

import asyncio
import json
import logging
import os
import re
import time
import datetime
import uuid

from google import genai
from sqlalchemy.orm import Session

from app.main import DataRoom, Folder, File, Classification

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gemini configuration
# ---------------------------------------------------------------------------

_MODEL_NAME = "gemini-2.0-flash"
_TEMPERATURE = 0.1


def _get_client() -> genai.Client:
    """Create a Gemini client using the new google-genai SDK."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in environment variables.")
    return genai.Client(api_key=api_key)


# ---------------------------------------------------------------------------
# Fingerprint & folder-tree helpers
# ---------------------------------------------------------------------------

def create_fingerprint(file_record) -> dict:
    """
    Build a lightweight fingerprint dict from a File ORM object.
    Used as input context for the Gemini classification prompt.
    """
    text = file_record.extracted_text or ""

    # For images where extracted_text is just "[Image: filename]", use name-based preview
    if text.startswith("[Image:"):
        preview = f"(image file: {file_record.original_name})"
    else:
        preview = text[:1000]

    return {
        "id": file_record.id,
        "name": file_record.original_name,
        "extension": file_record.file_extension,
        "preview": preview,
        "type": file_record.mime_type or "unknown",
    }


def build_folder_tree(session, dataroom_id: str) -> str:
    """
    Query all folders for a DataRoom and build a nested text tree
    with IDs and context descriptions for use in the Gemini prompt.
    """
    folders = (
        session.query(Folder)
        .filter_by(dataroom_id=dataroom_id)
        .order_by(Folder.display_order)
        .all()
    )

    # Build lookup by parent_id
    children_map = {}
    for f in folders:
        parent = f.parent_id or "__root__"
        children_map.setdefault(parent, []).append(f)

    lines = []

    def _recurse(parent_key: str, depth: int):
        for f in children_map.get(parent_key, []):
            indent = "  " * depth
            lines.append(f"{indent}- [{f.id}] {f.name}: {f.context}")
            _recurse(f.id, depth + 1)

    _recurse("__root__", 0)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Gemini API wrapper
# ---------------------------------------------------------------------------

async def _call_gemini(prompt_system: str, prompt_user: str, retries: int = 3) -> str:
    """
    Call Gemini using the google-genai async SDK and return the raw text response.
    Handles retries with exponential backoff.
    """
    client = _get_client()

    last_error = None
    for attempt in range(retries):
        try:
            response = await client.aio.models.generate_content(
                model=_MODEL_NAME,
                contents=prompt_user,
                config={
                    "system_instruction": prompt_system,
                    "temperature": _TEMPERATURE,
                },
            )
            raw = response.text

            # Strip markdown code fences if present
            raw = re.sub(r"^```(?:json)?\s*\n?", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\n?```\s*$", "", raw, flags=re.MULTILINE)
            raw = raw.strip()

            # Validate it's parseable JSON
            json.loads(raw)
            return raw

        except json.JSONDecodeError as e:
            last_error = e
            logger.warning(
                "Gemini returned invalid JSON (attempt %d/%d): %s",
                attempt + 1, retries, str(e)[:200],
            )
            # On second attempt, append a re-prompt hint
            if attempt == 1:
                prompt_user += (
                    "\n\nIMPORTANT: Your previous response was not valid JSON. "
                    "Return ONLY a valid JSON object/array with no extra text."
                )
        except Exception as e:
            last_error = e
            logger.warning(
                "Gemini API error (attempt %d/%d): %s",
                attempt + 1, retries, str(e)[:200],
            )

        # Exponential backoff: 1s, 2s, 4s
        if attempt < retries - 1:
            await asyncio.sleep(2 ** attempt)

    raise RuntimeError(f"Gemini API failed after {retries} attempts: {last_error}")


# ---------------------------------------------------------------------------
# Classification logic
# ---------------------------------------------------------------------------

async def _classify_batch(
    batch: list[dict],
    folder_tree: str,
    folder_ids_set: set[str],
) -> list[dict]:
    """
    Classify a single batch of up to 10 file fingerprints against
    the folder tree. Returns a list of classification result dicts.
    """
    system_prompt = (
        "You are a document classification AI. You assign files to the most "
        "appropriate folder based on file name, content preview, and folder context descriptions.\n\n"
        "Rules:\n"
        "1. Return ONLY a JSON array — no markdown, no explanation.\n"
        "2. Each element must have: file_id, folder_id (or null), confidence (0.0-1.0), reasoning (short string).\n"
        "3. folder_id must be one of the provided folder IDs, or null if no folder fits.\n"
        "4. confidence should reflect how well the file matches the chosen folder.\n"
    )

    files_json = json.dumps(batch, indent=2)

    user_prompt = (
        f"## Folder structure\n{folder_tree}\n\n"
        f"## Files to classify\n{files_json}\n\n"
        "Classify each file into the best-matching folder. "
        "Return a JSON array of objects with keys: file_id, folder_id, confidence, reasoning."
    )

    start = time.time()
    raw = await _call_gemini(system_prompt, user_prompt)
    elapsed = time.time() - start
    logger.info("Batch of %d files classified in %.2fs", len(batch), elapsed)

    results = json.loads(raw)

    # Validate and sanitise
    validated = []
    for r in results:
        fid = r.get("folder_id")
        if fid is not None and fid not in folder_ids_set:
            fid = None
        validated.append({
            "file_id": r["file_id"],
            "folder_id": fid,
            "confidence": float(r.get("confidence", 0.0)),
            "reasoning": r.get("reasoning", ""),
        })

    return validated


async def classify_files(engine, dataroom_id: str, file_ids: list[str]) -> dict:
    """
    Main orchestrator for POST /ai/classify.
    Classifies files into existing DataRoom folders using Gemini.
    """
    overall_start = time.time()

    with Session(engine) as session:
        # 1. Fetch folders and build tree
        folders = (
            session.query(Folder)
            .filter_by(dataroom_id=dataroom_id)
            .all()
        )
        if not folders:
            raise ValueError("DataRoom has no folders to classify into.")

        folder_ids_set = {f.id for f in folders}
        folder_tree = build_folder_tree(session, dataroom_id)

        # 2. Fetch files and create fingerprints
        files = session.query(File).filter(File.id.in_(file_ids)).all()
        found_ids = {f.id for f in files}
        missing = [fid for fid in file_ids if fid not in found_ids]

        fingerprints = [create_fingerprint(f) for f in files]

    # 3. Split into batches of 10
    batches = [fingerprints[i:i + 10] for i in range(0, len(fingerprints), 10)]

    # 4. Classify all batches in parallel
    tasks = [
        _classify_batch(batch, folder_tree, folder_ids_set)
        for batch in batches
    ]
    batch_results = await asyncio.gather(*tasks)

    # 5. Merge results
    all_results = []
    for br in batch_results:
        all_results.extend(br)

    # 6. Update DB
    classified_count = 0
    skipped_count = 0

    with Session(engine) as session:
        for r in all_results:
            file_record = session.query(File).filter_by(id=r["file_id"]).first()
            if not file_record:
                continue

            # Update file status
            file_record.status = "classified"
            file_record.updated_at = datetime.datetime.utcnow()

            # Only assign folder if confidence >= 0.4
            if r["folder_id"] and r["confidence"] >= 0.4:
                file_record.folder_id = r["folder_id"]
                classified_count += 1
            else:
                skipped_count += 1

            # Create Classification record only when a folder was suggested
            if r["folder_id"]:
                classification = Classification(
                    id=str(uuid.uuid4()),
                    file_id=r["file_id"],
                    folder_id=r["folder_id"],
                    confidence=r["confidence"],
                    reasoning=r["reasoning"],
                )
                session.add(classification)

        session.commit()

    elapsed = time.time() - overall_start

    return {
        "status": "success",
        "dataroom_id": dataroom_id,
        "total_files": len(file_ids),
        "classified": classified_count,
        "low_confidence_skipped": skipped_count,
        "missing_file_ids": missing,
        "time_seconds": round(elapsed, 2),
        "results": all_results,
    }


# ---------------------------------------------------------------------------
# DataRoom generation logic
# ---------------------------------------------------------------------------

async def generate_dataroom(
    engine,
    name: str,
    description: str,
    file_ids: list[str],
) -> dict:
    """
    Main orchestrator for POST /ai/generate-dataroom.
    Creates a new DataRoom with AI-generated folders and file assignments.
    """
    overall_start = time.time()

    # 1. Fetch files and create fingerprints
    with Session(engine) as session:
        files = session.query(File).filter(File.id.in_(file_ids)).all()
        found_ids = {f.id for f in files}
        missing = [fid for fid in file_ids if fid not in found_ids]

        # Use shorter previews for large batches
        preview_len = 500 if len(files) > 30 else 1000
        fingerprints = []
        for f in files:
            fp = create_fingerprint(f)
            fp["preview"] = fp["preview"][:preview_len]
            fingerprints.append(fp)

    # 2. Single Gemini call to generate folder structure + assignments
    system_prompt = (
        "You are a document organization AI. Given a set of files, you create "
        "a logical folder structure and assign each file to the best folder.\n\n"
        "Rules:\n"
        "1. Return ONLY a JSON object — no markdown, no explanation.\n"
        "2. The JSON must have two keys: 'folders' and 'assignments'.\n"
        "3. 'folders' is an array of objects with: name, context (description of what belongs here), "
        "children (array of nested folder objects, same structure, can be empty).\n"
        "4. 'assignments' is an array of objects with: file_id, folder_path (array of folder names "
        "from root to target, e.g. ['Legal', 'Contracts']), confidence (0.0-1.0), reasoning.\n"
        "5. Create 3-10 top-level folders. Use subfolders only when clearly needed.\n"
        "6. Every file must appear in assignments, even if confidence is low.\n"
        "7. folder_path must match exactly the folder names you defined.\n"
    )

    files_json = json.dumps(fingerprints, indent=2)

    user_prompt = (
        f"## DataRoom: {name}\n"
        f"## Description: {description or 'No description provided'}\n\n"
        f"## Files to organize ({len(fingerprints)} files)\n{files_json}\n\n"
        "Create an organized folder structure and assign each file to the best folder."
    )

    raw = await _call_gemini(system_prompt, user_prompt)
    gemini_result = json.loads(raw)

    # 3. Create DataRoom
    with Session(engine) as session:
        dataroom = DataRoom(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            created_by_ai=True,
        )
        session.add(dataroom)
        session.flush()

        # 4. Recursively create folders — build path-to-id mapping
        folder_path_map = {}  # tuple of names -> folder id

        def _create_folders(folder_defs: list, parent_id=None, path_prefix=()):
            for order, fdef in enumerate(folder_defs):
                folder_name = fdef["name"]
                folder_context = fdef.get("context", folder_name)
                current_path = path_prefix + (folder_name,)

                folder = Folder(
                    id=str(uuid.uuid4()),
                    dataroom_id=dataroom.id,
                    name=folder_name,
                    context=folder_context,
                    parent_id=parent_id,
                    display_order=order,
                    created_by_ai=True,
                )
                session.add(folder)
                session.flush()

                folder_path_map[current_path] = folder.id

                children = fdef.get("children", [])
                if children:
                    _create_folders(children, parent_id=folder.id, path_prefix=current_path)

        _create_folders(gemini_result.get("folders", []))

        # 5. Assign files and create Classification records
        assigned_count = 0
        unassigned_count = 0

        for assignment in gemini_result.get("assignments", []):
            file_id = assignment.get("file_id")
            folder_path = tuple(assignment.get("folder_path", []))
            confidence = float(assignment.get("confidence", 0.0))
            reasoning = assignment.get("reasoning", "")

            folder_id = folder_path_map.get(folder_path)
            if not folder_id:
                unassigned_count += 1
                continue

            # Update file record
            file_record = session.query(File).filter_by(id=file_id).first()
            if not file_record:
                continue

            file_record.dataroom_id = dataroom.id
            file_record.folder_id = folder_id if confidence >= 0.4 else None
            file_record.status = "classified"
            file_record.updated_at = datetime.datetime.utcnow()

            # Create Classification record
            classification = Classification(
                id=str(uuid.uuid4()),
                file_id=file_id,
                folder_id=folder_id,
                confidence=confidence,
                reasoning=reasoning,
            )
            session.add(classification)
            assigned_count += 1

        session.commit()
        session.refresh(dataroom)

        elapsed = time.time() - overall_start

        return {
            "status": "success",
            "dataroom": {
                "id": dataroom.id,
                "name": dataroom.name,
                "description": dataroom.description,
                "created_by_ai": True,
            },
            "folders_created": len(folder_path_map),
            "files_assigned": assigned_count,
            "files_unassigned": unassigned_count,
            "missing_file_ids": missing,
            "time_seconds": round(elapsed, 2),
        }

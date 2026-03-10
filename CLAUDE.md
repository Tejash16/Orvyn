# CLAUDE.md — DocRack Desktop App

This file defines the strict architecture, runtime, and development rules for the DocRack Desktop App.
Claude must read and follow every rule in this file before taking any action on this codebase.

---

## Copilot Feature Guide
Architecture and implementation guide for the Copilot feature: ./DocRack-Copilot-guide.md

## 1. Project Overview

**DocRack** is a Windows-only desktop application for intelligent document management.
It combines a local AI engine, a local database, and a cloud authentication layer into a unified desktop experience powered by Electron.

| Layer            | Technology                     | Deployment     |
|------------------|--------------------------------|----------------|
| Desktop shell    | Electron (main + preload)      | Local (Windows) |
| UI               | React + Vite + SWC (JS)        | Loaded by Electron |
| Auth backend     | Express (Node.js)              | Cloud           |
| AI engine        | Python FastAPI                 | Local           |
| Database         | SQLite                         | Local           |

---

## 2. Folder Structure Definition

```
Docrack/
├── electron/               # Electron main process + preload
│   ├── main.js             # App entry point, lifecycle, IPC
│   ├── preload.js          # contextBridge API exposed to React
│   ├── package.json        # Electron dependencies
│   ├── ipc/                # IPC handler modules (registered in main.js)
│   │   ├── authHandlers.js
│   │   ├── settingsHandlers.js
│   │   └── windowControls.js
│   ├── services/           # Electron-side service modules
│   │   ├── authService.js          # Auth orchestration
│   │   ├── expressService.js       # Express AI proxy communication
│   │   ├── logger.js               # electron-log wrapper (file-based logging)
│   │   ├── pythonProcess.js        # Python process lifecycle + dynamic port
│   │   ├── pythonService.js        # Python API communication
│   │   ├── tokenRefreshScheduler.js # Token refresh logic
│   │   ├── tokenVault.js           # Secure token storage
│   │   └── userContextService.js   # User context management
│   ├── .env                # Runtime config (NOT committed)
│   └── .env.example        # Safe template (committed)
│
├── frontend/               # React UI (Vite + SWC)
│   ├── src/
│   │   ├── main.jsx        # React entry point
│   │   ├── App.jsx         # Root component
│   │   ├── components/     # Reusable UI components
│   │   │   ├── auth/       # Authentication components (Login, Register, etc.)
│   │   │   └── layout/     # Layout components (Header, Sidebar)
│   │   ├── pages/          # Page-level components (routed views)
│   │   └── store/          # Redux store, slices, and thunks
│   ├── vite.config.js      # Vite build config (dev only)
│   └── package.json
│
├── express-backend/        # Cloud auth server (Node.js + Express)
│   ├── src/
│   │   ├── server.js       # Express app entry point
│   │   ├── config/         # Environment and app configuration
│   │   ├── controllers/    # Route handler logic
│   │   ├── middleware/     # Express middleware (auth, rate limiting, errors)
│   │   ├── models/         # Data models / DB schema definitions
│   │   ├── routes/         # Route definitions (auth, health, ai)
│   │   └── services/       # Business logic services (geminiService, logger)
│   ├── .env                # Auth secrets (NOT committed)
│   └── .env.example
│
├── python-backend/         # Local AI engine (FastAPI)
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py         # FastAPI app
│   ├── run.py              # Startup script
│   ├── requirements.txt    # Python dependencies
│   ├── .env                # Python runtime config (NOT committed)
│   └── .env.example
│
├── package.json            # Root scripts (concurrently runner only)
└── CLAUDE.md               # This file
```

The folder structure above is fixed. Do not move, rename, or restructure any folder or file
across layers without an explicit instruction from the user.

---

## 3. Responsibilities of Each Layer

### Electron (`electron/`)
- Owns the application lifecycle (startup, shutdown, window management).
- Reads all runtime configuration from `electron/.env` via `dotenv`.
- Exposes configuration to React via `preload.js` using Electron's `contextBridge`.
- Spawns and manages the Python FastAPI process with **dynamic port allocation** (see Section 13.6).
- Handles all IPC (inter-process communication) between React and the system.
- Is the **single source of truth** for runtime config at the desktop layer.

### React (`frontend/`)
- Renders the UI only. No business logic, no file I/O, no direct API calls to Python.
- Receives all runtime configuration through `window.api.getConfig()` (injected by preload).
- Communicates with Electron via IPC (contextBridge methods), not direct Node.js APIs.
- Has no knowledge of local file paths, ports, or environment-specific values.

### Express (`express-backend/`)
- Handles authentication, session management, and AI API proxying (cloud-hosted).
- Issues and validates tokens used by other layers.
- Owns the Gemini API key — all LLM calls are routed through Express so that the
  API key never ships with the desktop application.
- AI proxy endpoints (`/api/v1/ai/*`) require Bearer token authentication.
- Must not contain any document processing or file system logic.

### Python FastAPI (`python-backend/`)
- Runs locally, spawned by Electron at startup on a dynamically allocated port (see Section 13.6).
- Owns all Smart DataRoom logic: document ingestion, text extraction, data preparation,
  and database operations. Does NOT call LLM APIs directly.
- Prepares data (fingerprints, folder trees) for AI classification and applies
  results received from Express/Gemini back to the local database.
- All business routes are versioned under `/api/v1/`. Infrastructure routes (`/health`,
  `/init-db`) remain unversioned.
- Reads its own config from `python-backend/.env`. Port is passed via `--port` CLI arg
  by Electron (overrides env default).
- Exposes a local HTTP API consumed by Electron via IPC (never directly by React).

### SQLite
- Local database owned and accessed exclusively by the Python backend.
- No other layer may read from or write to the SQLite file directly.

---

## 4. Runtime Configuration Rules (CRITICAL)

These rules are non-negotiable. Violating them breaks the production build.

### Rules

1. **React MUST NOT use `import.meta.env` for runtime configuration in production.**
   Vite inlines `import.meta.env` values at build time. The resulting static bundle
   cannot be reconfigured at runtime without a rebuild. This makes it unsuitable for
   a distributed desktop app.

2. **React MUST NOT rely on `frontend/.env` for production behavior.**
   Any `.env` file under `frontend/` is a Vite build-time concern only (e.g., dev server
   port). It must never carry values that differ between machines or environments.

3. **All runtime configuration flows: `electron/.env` → `preload.js` (contextBridge) → `window.api.getConfig()`.**
   Electron reads `.env` via `dotenv`, exposes values through preload. React accesses them
   only via `window.api.getConfig()`. No other path is permitted.

4. **React must NEVER call Express or Python directly using hardcoded localhost ports.**
   All backend communication must go through Electron IPC unless explicitly approved.

### Correct Pattern

React must never call backend services directly.

Instead, React calls Electron via the preload bridge:

```js
// React component
await window.api.login({ email, password });
```

---

## 5. Environment Variable Policy

| File                          | Committed | Purpose                                      |
|-------------------------------|-----------|----------------------------------------------|
| `electron/.env`               | No        | Runtime config: URLs, ports, API keys        |
| `electron/.env.example`       | Yes       | Safe template showing required keys          |
| `express-backend/.env`        | No        | Auth secrets, DB strings, GEMINI_API_KEY     |
| `express-backend/.env.example`| Yes       | Safe template                                |
| `python-backend/.env`         | No        | Python runtime config (host, port only)      |
| `python-backend/.env.example` | Yes       | Safe template                                |
| `frontend/.env`               | No        | Vite dev-only (e.g., VITE_DEV_PORT). Never production config. |

Rules:
- Never commit any `.env` file. Only `.env.example` files are committed.
- Never put secrets, tokens, or API keys in `.env.example`.
- Never add `VITE_` prefixed variables that carry production runtime values.

---

## 6. Git & Security Rules

- `.env` files in all subdirectories are gitignored and must never be committed.
- If you use the any variable from the `.env` file and it does not exist in the `.env.example` add variable there.
- if you think some variabe that is important should be put in the .env. put that there and use it from there.
- `.gitignore` must not be modified without explicit user instruction.
- `node_modules/`, `venv/`, `__pycache__/`, `dist/`, and `*.pyc` must remain gitignored.
- No secrets, tokens, passwords, or private keys may appear in any committed file.
- Sensitive values must only ever appear in `.env` files (which are gitignored).
- Do not add `console.log` statements that print secrets or config values.

---

## 7. Strict Instructions — Claude MUST NOT

The following actions are **prohibited** unless the user provides an explicit, unambiguous
instruction authorizing each specific action:

1. **Change the folder structure.** Do not move, rename, create, or delete top-level
   folders (`electron/`, `frontend/`, `express-backend/`, `python-backend/`, `shared/`).

2. **Move files across layers.** A file that belongs to `electron/` stays in `electron/`.
   Do not relocate source files between layer directories.

3. **Modify `package.json` dependencies** in any layer (root, electron, frontend, express-backend)
   without explicit user approval for each change.

4. **Install new npm packages** (`npm install <pkg>`) automatically. Always confirm with
   the user before adding any dependency.

5. **Install new Python packages** (`pip install <pkg>`) or modify `requirements.txt`
   automatically. Always confirm with the user first.

6. **Touch build configuration** (`vite.config.js`, `electron-builder.config.js`, Babel,
   ESLint configs, etc.) without explicit approval.

7. **Violate runtime configuration rules** defined in Section 4 (`import.meta.env`, `VITE_` vars,
   hardcoded URLs/ports are all forbidden).

8. **Introduce cross-layer coupling.** React must not import from `electron/`,
    `express-backend/`, or `python-backend/`. Each layer communicates only through its
    defined interface (IPC, HTTP).

9. **Violate git/security rules** in Section 6 (no `.gitignore` changes, no committed secrets).

10. **Remove Windows-only assumptions.** This app targets Windows exclusively. Do not
    introduce cross-platform abstractions (e.g., `path.posix`, `process.platform` guards)
    unless explicitly asked.

11. **Modify or bypass the preload/contextBridge pattern.** Do not suggest using
    `nodeIntegration: true`, `contextIsolation: false`, or direct `require()` calls in
    the renderer as shortcuts.

12. **Auto-generate or scaffold large amounts of boilerplate** without confirmation. Propose
    first, implement after approval.

13. **Rename or reorganize existing source files** without explicit instruction, even if
    the current names seem inconsistent.

14. **Add logging, telemetry, or analytics** of any kind without explicit user approval.

15. **Modify the root `package.json` scripts** without explicit instruction. The `dev`
    script orchestrates all four processes and must not be changed without review.

16. **Rewrite existing working code** unless explicitly requested. Do not refactor large
    modules automatically.

---

## 8. Windows-Only Assumptions

This application targets Windows exclusively. Do not add macOS/Linux targets or cross-platform abstractions.

- Use Node.js `path.join()` / `path.resolve()` — do not hardcode path separators.
- Python spawning uses `venv\Scripts\python.exe` (not Unix `venv/bin/python`).
- Electron's `app.getPath()` returns Windows paths. SQLite paths are Windows absolute paths.
- Installers/packaging: Windows-only (NSIS, Squirrel, or similar).
- No POSIX shell syntax in production scripts. Use `.bat`, `.cmd`, or PowerShell.

---

## 9. Development Workflow Instructions

### Starting the dev environment

From the project root:

```bash
npm run dev
```

This uses `concurrently` to start all four processes:
- React dev server (Vite) — `frontend/`
- Electron — `electron/`
- Express backend — `express-backend/`
- Python FastAPI — `python-backend/`

### Before making any change

1. Identify which layer owns the code being changed.
2. Confirm the change does not violate any rule in Section 7.
3. For dependency changes, ask the user before touching any `package.json` or `requirements.txt`.

### Adding a new feature

1. Determine which layer(s) are responsible (see Section 3).
2. Keep logic in the correct layer. Do not leak business logic into React.
3. Expose new IPC handlers in `electron/main.js` and `electron/preload.js` if React needs
   to trigger backend actions.
4. React calls `window.api.<methodName>()` — never calls Python or Express directly.

---

## 10. UI Architecture Rules (Redux & Theme)

DocRack uses Redux as the official global state management layer.

### Redux Rules

- Redux is the only permitted global state manager.
- Claude must NOT introduce alternative state libraries (Zustand, MobX, Recoil, Context API for global state, etc.).
- All cross-component state (auth state, user profile, dataroom state, UI state) must live in Redux.
- Local component state (`useState`) is allowed only for temporary UI concerns (modal open/close, form input typing, etc.).
- Redux store must be defined under `frontend/src/store/`.
- Redux slices must be organized by domain (`authSlice`, `dataroomSlice`, `uiSlice`, etc.).
- Business logic must not leak into React components — use thunks or middleware when needed.

### Persistence Rules

- Only non-sensitive UI preferences may be persisted (e.g., theme).
- Sensitive data (JWT tokens, API keys, secrets) must NEVER be persisted in Redux or localStorage.
- Authentication tokens must be handled securely via Electron runtime or secure storage.
- Theme, sidebar state, or any UI preference must NOT use `localStorage`, `sessionStorage`, or cookies.
- Theme persistence will be implemented in a future milestone via SQLite (managed by the Python backend through Electron IPC).
- Until SQLite persistence is implemented, theme always resets to `light` on launch.

### Theme Architecture

- Default theme is `light` on every application launch.
- Theme state is managed exclusively in Redux (`uiSlice`).
- Theme is applied at the root container level via a `data-theme` attribute on the `app-shell` element.
- All colors must be defined as CSS custom properties (variables) scoped to `[data-theme="light"]` and `[data-theme="dark"]`.
- No component may hardcode color values — all colors must use CSS variables.
- Future UI components must support both light and dark themes from the start.
- Do not apply theme at the `document`, `html`, or `body` level — it must apply at the `app-shell` container.
- Do not introduce CSS-in-JS libraries without approval.

---

## 12. Security Hardening Rules

Claude must NOT:

- Enable `nodeIntegration`, disable `contextIsolation`, or bypass preload/contextBridge protections.
- Use `eval`, `new Function()`, or dynamically fetch and execute remote scripts.
- Expose Node.js APIs or filesystem access directly to the renderer.
- Store secrets in memory accessible to the renderer.
- Use `exec()` for shell commands — use `execFile()` with array arguments to prevent injection.
- Place any LLM API key in `electron/.env`, `python-backend/.env`, or any file shipped with the desktop app. LLM keys live in `express-backend/.env` only.
- Call Gemini or any external LLM API from Python backend or Electron. All LLM calls go through Express.

All privileged operations follow: React → preload (contextBridge) → Electron main → Python (if required).
AI classification flow is detailed in Section 16.

Claude must NEVER rewrite the React → Electron → Python → Express architecture.
All cross-layer communication must follow the defined flow.

### Rate Limiting

Rate limiter middleware: `express-backend/src/middleware/rateLimiter.js`. All public Express endpoints must include rate limiting. Current limits (15-min window): Register 5, Login 5, Forgot Password 3, Reset Password 5, Resend Verification 3.

---

## 13. Versioning Policy

### Application Versioning

- The application version must be defined in `electron/package.json`.
- Follow Semantic Versioning: MAJOR.MINOR.PATCH.
  - MAJOR = breaking changes
  - MINOR = new features
  - PATCH = bug fixes
- Do not modify versioning strategy without explicit instruction.

### API Versioning

All API routes (Express and Python business routes) are under `/api/v1/`. Python infrastructure routes (`/health`, `/init-db`) are unversioned. Backward-compat aliases at `/api/` exist temporarily in Express — new code must always use `/api/v1/`.

- New endpoints MUST be under `/api/v1/` (or `/api/v2/` for breaking changes).
- When changing an endpoint's contract, create a new version — do not modify v1.

---

## 13.5. Logging

DocRack uses structured, file-based logging across all layers. Logs are essential
for diagnosing issues in packaged builds where there is no console.

### Log Locations

| Layer | Library | Log Path | Rotation |
|-------|---------|----------|----------|
| Electron | `electron-log` | `%APPDATA%/DocRack/logs/electron.log` | 5 MB, archived with timestamp |
| Python | `logging.handlers.RotatingFileHandler` | Same dir as Electron (via `DOCRACK_LOG_DIR` env) | 5 MB, 5 backup files |
| Express | `winston` | `express-backend/logs/express.log` | 5 MB, 5 backup files |

### Architecture

- **Electron** (`electron/services/logger.js`): Wraps `electron-log`. Use `const log = require('./logger')`.
- **Python**: Log directory is passed from Electron via `DOCRACK_LOG_DIR` env var. Falls back to `python-backend/logs/` in dev.
- **Express** (`src/services/logger.js`): Wraps `winston`. Morgan HTTP logs piped through winston.

### IPC Channels for Logs

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `app:getLogsPath` | `window.api.logs.getPath()` | Get absolute path to logs directory |
| `app:openLogsFolder` | `window.api.logs.openFolder()` | Open logs folder in Windows Explorer |

### Rules

- All new code in Electron MUST use the logger module, not `console.*`.
- Express MUST use the winston logger, not `console.*`.
- Python MUST use `logging.getLogger(__name__)`, not `print()`.
- Logs must NEVER contain secrets, tokens, passwords, or API keys.
- Log files are local to each machine — never committed or uploaded.

---

## 13.6. Dynamic Port Allocation

The Python backend runs on a dynamically allocated port to prevent conflicts.

### How It Works

1. **Electron** (`services/pythonProcess.js`) calls `_findFreePort()` which binds a
   `net.Server` to port 0, reads the OS-assigned port, then closes the server.
2. The free port is passed to Python via `--port` CLI argument.
3. `process.env.PYTHON_URL` is set to `http://127.0.0.1:<port>` so `pythonService.js`
   picks it up automatically.
4. On restart (crash recovery), a new free port is allocated each time.

### Rules

- `PYTHON_URL` in `electron/.env` is used as a fallback only if dynamic allocation fails.
- Python's `run.py` accepts `--port` and `--host` CLI args (override env defaults).
- Never hardcode port 8000 in Electron or Python code.

---

## 14. Responsive UI & Window Resizing Rules

The UI must adapt fluidly across resolutions (1366x768 to 4K) and manual window resizing.

- All major layout containers must use Flexbox or CSS Grid. Fixed-width layouts are prohibited.
- Content areas must use `flex: 1`; sidebar uses fixed width with collapse, must not flex-grow.
- Main content area must scroll internally (`overflow: auto`) instead of breaking layout.
- Electron window must define `minWidth` and `minHeight`.
- Use responsive grid patterns: `grid-template-columns: repeat(auto-fit, minmax(Xpx, 1fr))`.
- Prefer relative units (`rem`, `%`, `clamp()`). Avoid absolute positioning for layout structure.
- All errors/success messages shown to the user must use toast notifications in human-readable format.

---

## 15. Smart DataRoom Architecture

DocRack's core feature is the Smart DataRoom — an AI-powered virtual file organizer.

### Virtual File System

- Files are **never copied** into the application. DocRack stores only the absolute path
  reference (`original_path`) in SQLite. The actual file stays on disk where the user placed it.
- If a file is moved or deleted externally, DocRack detects this via `file:check-exists` and
  offers a **Relocate** option so the user can point to the new location.
- File metadata (name, extension, size, checksum, extracted text) is stored in the database
  alongside the path reference.

### Supported File Types

`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.csv`, `.png`, `.jpg`, `.jpeg`

Any file with an unsupported extension is rejected at registration time.

### Classification Modes

1. **Custom Classification** — User selects an existing DataRoom. Files are registered into
   that DataRoom, then the AI classifies each file into the DataRoom's existing folder
   structure based on folder context descriptions.

2. **AI Auto-Organize** — User provides a name and optional description. The AI creates an
   entirely new DataRoom with an auto-generated folder structure, then classifies all files
   into those folders.

### Constraints

- Maximum **50 files** per classification batch.
- Nested folder structure with unlimited depth. Each folder node has a `context` field
  (description) that guides the AI classifier.
- File fingerprinting extracts the first **1000 characters** of text content per file for
  AI classification input.

---

## 16. Classification Engine

The classification engine is split across two layers for API key security:
- **Data preparation & DB updates** — `python-backend/app/services/classification_service.py`
- **LLM API calls** — `express-backend/src/services/geminiService.js`
- **Orchestration** — `electron/ipc/aiHandlers.js`

### Architecture: 3-Step AI Flow

All AI classification follows this flow to keep the Gemini API key off the desktop:

1. **Electron → Python** (`prepare-classify` / `prepare-generate`)
   Python reads SQLite, builds file fingerprints and folder trees, returns data.

2. **Electron → Express** (`/api/ai/classify` / `/api/ai/generate-dataroom`)
   Express receives the prepared data, calls Gemini (API key lives server-side),
   returns AI results. Requires Bearer token authentication.

3. **Electron → Python** (`apply-classify` / `apply-generate`)
   Python applies AI results to SQLite (folder assignments, Classification records).

**The Gemini API key MUST only exist in `express-backend/.env`. It must NEVER be
placed in `electron/.env`, `python-backend/.env`, or any file shipped with the desktop app.**

### Processing Pipeline

1. **Text Extraction** — On file registration, the Python backend extracts text from each
   file (PDF via PyPDF2, DOCX via python-docx, XLSX/CSV via openpyxl/csv, PPTX via
   python-pptx, images via OCR, TXT directly). Stores up to 5000 chars in `extracted_text`.

2. **Fingerprinting** — For classification, each file's fingerprint is built from:
   `filename + extension + first 1000 chars of extracted_text`.

3. **Batched Parallel Processing** — Express splits files into batches of **10 files per
   Gemini API call**. Up to **5 batches run in parallel** using `Promise.all()`,
   processing a maximum of 50 files efficiently.

4. **Folder Assignment** — The AI returns a `folder_id` and `confidence` score (0.0–1.0)
   for each file.

### AI Model Configuration

- **Model**: `gemini-2.0-flash` (Google Generative AI)
- **Temperature**: `0.1` (low variance for consistent classification)
- **Response format**: Structured JSON with `folder_id`, `confidence`, `reasoning`
- **SDK**: `@google/generative-ai` (npm, Express backend only)

### Confidence Threshold

- Minimum confidence: **0.4** for folder assignment.
- Files scoring below 0.4 remain **unclassified** (folder_id = null).
- The `classification_score` is stored on the file record and displayed as a colored
  confidence dot in the UI (green ≥ 0.8, yellow ≥ 0.6, orange ≥ 0.4).

---

## 17. IPC Channels

All IPC channels are defined in `electron/ipc/` handler files and exposed via
`electron/preload.js` through `contextBridge`. React accesses them via `window.api.*`.

### `dataroom:*` — DataRoom CRUD

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `dataroom:create` | `window.api.dataroom.create({name, description})` | Create a new DataRoom |
| `dataroom:list` | `window.api.dataroom.list()` | List all DataRooms with folder/file counts |
| `dataroom:get` | `window.api.dataroom.get(id)` | Get DataRoom with folders and files |
| `dataroom:update` | `window.api.dataroom.update(id, updates)` | Update name/description |
| `dataroom:delete` | `window.api.dataroom.delete(id)` | Delete DataRoom and all contents |

### `folder:*` — Folder Operations

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `folder:create` | `window.api.folder.create(dataroomId, parentFolderId, name, context)` | Create folder with context description |
| `folder:get-children` | `window.api.folder.getChildren(dataroomId, folderId)` | Get subfolders + files for a folder (null = root) |
| `folder:rename` | `window.api.folder.rename(folderId, newName)` | Rename a folder |
| `folder:update-context` | `window.api.folder.updateContext(folderId, context)` | Update folder description |
| `folder:delete` | `window.api.folder.delete(folderId)` | Delete folder (files become unclassified) |
| `folder:move` | `window.api.folder.move(folderId, newParentId)` | Move folder to new parent |

### `file:*` — File Operations

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `file:select-files` | `window.api.file.selectFiles()` | Open native file picker dialog |
| `file:select-folder` | `window.api.file.selectFolder()` | Open native folder picker, scan recursively |
| `file:register` | `window.api.file.register(dataroomId, filePaths)` | Register file paths in DataRoom (max 50) |
| `file:get-details` | `window.api.file.getDetails(fileId)` | Get full file metadata + extracted text |
| `file:list` | `window.api.file.list(dataroomId, options)` | List files with folder/status filters |
| `file:check-exists` | `window.api.file.checkExists(fileId)` | Check if file still exists on disk |
| `file:move-to-folder` | `window.api.file.moveToFolder(fileId, folderId)` | Move file to a different folder |
| `file:rename` | `window.api.file.rename(fileId, newName)` | Rename file display name (not on disk) |
| `file:relocate` | `window.api.file.relocate(fileId)` | Open picker to update path for moved file |
| `file:remove-from-docrack` | `window.api.file.removeFromDocrack(fileId)` | Remove from DB only, keep file on disk |
| `file:delete-from-system` | `window.api.file.deleteFromSystem(fileId)` | Delete from DB AND from disk |
| `file:open` | `window.api.file.open(filePath)` | Open file with default system app |
| `file:open-with` | `window.api.file.openWith(filePath)` | Open Windows "Open With" dialog |
| `file:copy-path` | `window.api.file.copyPath(filePath)` | Copy file path to clipboard |
| `file:copy-to-clipboard` | `window.api.file.copyToClipboard(filePath)` | Copy file itself to clipboard |
| `file:get-paths-info` | `window.api.file.getPathsInfo(filePaths)` | Get metadata for paths without registering |
| `file:scan-folder` | `window.api.file.scanFolder(folderPath)` | Recursively scan folder for file paths |

### `ai:*` — AI Classification (see Section 16 for full flow)

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `ai:classify` | `window.api.ai.classify(dataroomId, fileIds)` | Classify files into existing DataRoom folders |
| `ai:generate-dataroom` | `window.api.ai.generateDataroom(name, description, fileIds)` | Create AI-generated DataRoom with folders |

---

## 18. Python Backend Endpoints

All endpoints defined in `python-backend/app/main.py`.

### Infrastructure (unversioned)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check, returns DB table list |
| `POST` | `/init-db` | Initialize SQLite with `database_path` and `mongo_user_id` |

### Theme Settings

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/settings/theme` | Get current theme preference |
| `POST` | `/api/v1/settings/theme` | Set theme (`"light"` or `"dark"`) |

### DataRoom CRUD

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/datarooms` | Create DataRoom (`name`, optional `description`) |
| `GET` | `/api/v1/datarooms` | List all DataRooms with `folder_count` and `file_count` |
| `GET` | `/api/v1/datarooms/{dataroom_id}` | Get DataRoom with nested `folders[]` and `files[]` |
| `PUT` | `/api/v1/datarooms/{dataroom_id}` | Update DataRoom name/description |
| `DELETE` | `/api/v1/datarooms/{dataroom_id}` | Delete DataRoom and all children |

### Folder CRUD

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/datarooms/{dataroom_id}/folders` | Create folder (`name`, `context`, optional `parent_id`) |
| `GET` | `/api/v1/datarooms/{dataroom_id}/folders` | List all folders in DataRoom with `file_count` |
| `PUT` | `/api/v1/folders/{folder_id}` | Update folder (`name`, `context`, `parent_id`) |
| `DELETE` | `/api/v1/folders/{folder_id}` | Delete folder (files become unclassified) |

### File Management

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/files/register` | Register files (`dataroom_id`, `file_paths[]`, max 50) |
| `GET` | `/api/v1/files/{file_id}` | Get file details including `extracted_text` |
| `GET` | `/api/v1/datarooms/{dataroom_id}/files` | List files with optional `folder_id`, `include_subfolders`, `status` filters |
| `POST` | `/api/v1/files/{file_id}/check-exists` | Check if file exists at `original_path` |
| `PUT` | `/api/v1/files/{file_id}/relocate` | Update `original_path` to new location |
| `PUT` | `/api/v1/files/{file_id}/move-to-folder` | Move file to folder (`folder_id`, null = unclassified) |
| `PUT` | `/api/v1/files/{file_id}/rename` | Rename display name (`new_name`) |
| `DELETE` | `/api/v1/files/{file_id}` | Delete file record (query param `delete_from_system=true` also deletes from disk) |

### AI Data Preparation & Result Application (see Section 16 for full flow)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/ai/prepare-classify` | Build fingerprints + folder tree for Gemini classification |
| `POST` | `/api/v1/ai/apply-classify` | Apply Gemini classification results to the database |
| `POST` | `/api/v1/ai/prepare-generate` | Build file fingerprints for Gemini DataRoom generation |
| `POST` | `/api/v1/ai/apply-generate` | Create DataRoom + folders + assignments from Gemini results |

---

## 18.5. Express Endpoints

### Auth Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/auth/register` | Register new account (rate limited: 5/15min) |
| `POST` | `/api/v1/auth/verify-email` | Verify email with code |
| `POST` | `/api/v1/auth/login` | Login (rate limited: 5/15min) |
| `GET` | `/api/v1/auth/me` | Get current user (requires Bearer token) |
| `POST` | `/api/v1/auth/refresh` | Refresh access token |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token |
| `POST` | `/api/v1/auth/delete-account` | Delete account (requires Bearer token) |
| `POST` | `/api/v1/auth/resend-verification` | Resend verification email (rate limited: 3/15min) |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset (rate limited: 3/15min) |
| `POST` | `/api/v1/auth/reset-password` | Reset password with token (rate limited: 5/15min) |

### AI Proxy Endpoints (require Bearer token)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/ai/classify` | Receive fingerprints + folder tree, call Gemini, return classification results |
| `POST` | `/api/v1/ai/generate-dataroom` | Receive fingerprints + DataRoom info, call Gemini, return folder structure + assignments |

---

## 19. Redux Slices

All slices are in `frontend/src/store/`. Each slice uses Redux Toolkit's `createSlice` and
`createAsyncThunk`.

### `dataroomSlice.js` — DataRoom CRUD State

```
State shape:
  datarooms: []              — Array of all DataRooms
  activeDataroom: null       — Currently viewed DataRoom (with folders/files)
  isLoading: false           — Fetch in progress
  isCreating: false          — Creation in progress
  error: null                — Error message

Thunks: fetchDatarooms, fetchDataroom, createDataroom, updateDataroom, deleteDataroom
```

### `fileExplorerSlice.js` — Navigation & View State

```
State shape:
  currentDataroomId: null    — Active DataRoom ID
  currentFolderId: null      — Current folder (null = root)
  currentPath: []            — Breadcrumb path [{id, name, type}, ...]
  items: []                  — Current view items (files + folders merged)
  selectedItems: []          — Multi-selection [{id, type}, ...]
  viewMode: 'grid'           — 'grid' | 'list'
  sortBy: 'name'             — 'name' | 'size' | 'date'
  sortOrder: 'asc'           — 'asc' | 'desc'
  searchQuery: ''            — Local search filter
  isLoading: false           — Navigation in progress
  error: null                — Error message

Thunks: navigateToDataroom, navigateToFolder, navigateUp,
        navigateToPathIndex, navigateDirect, refreshCurrentView
```

### `fileSlice.js` — File Operations & Upload Modal

```
State shape:
  isRegistering: false              — File registration in progress
  isClassifying: false              — Classification in progress
  classificationResults: null       — Results from AI classification
  error: null                       — Error message
  uploadModal:
    registrationResult: null        — { registered, rejected }
    classificationResult: null      — Full classify response
    generationResult: null          — Full generate-dataroom response
    isRegistering: false
    isClassifying: false
    isGenerating: false
    error: null

Thunks: selectAndRegisterFiles, selectAndRegisterFolder, classifyFiles,
        generateDataroom, registerFiles, classifyRegisteredFiles,
        generateNewDataroom, moveFileToFolder, removeFromDocrack,
        deleteFromSystem, openFile, openFileWith, copyFilePath,
        copyFileToClipboard, relocateFile, renameFile
```

### `folderSlice.js` — Folder Operations

```
State shape:
  isCreating: false          — Folder creation in progress
  error: null                — Error message

Thunks: createFolder, renameFolder, deleteFolder, moveFolder, updateFolderContext
```

### `uiSlice.js` — Global UI State

```
State shape:
  sidebarCollapsed: true     — Sidebar collapsed/expanded
  theme: 'light'             — 'light' | 'dark'
  activePage: 'dataroom'     — Current page identifier
  showUploadModal: false     — Upload modal visibility
  toasts: []                 — Toast notifications [{id, message, type}, ...]
  toastCounter: 0            — Auto-increment toast ID
  isOnline: true             — Express backend reachable

Reducers: toggleSidebar, toggleTheme, setTheme, setActivePage,
          setOnline, openUploadModal, closeUploadModal, addToast, removeToast
```

---

## 20. File Explorer Architecture

The File Explorer (`frontend/src/components/dataroom/FileExplorer.jsx`) is the primary
interface for browsing DataRoom contents. It mimics Windows Explorer behavior.

### File Interaction

- Files are displayed by their `original_name` and metadata from the database.
- Double-clicking a file calls `file:open` (uses `shell.openPath()`).
- If the file no longer exists at `original_path`, the UI shows a "File not found" state
  with a **Relocate** button.

### Navigation & Views

- Breadcrumb bar with clickable path segments, back/up buttons, folder double-click to navigate.
- Navigation state managed by `fileExplorerSlice` with `currentPath[]`.
- **Grid view** — Cards with icons, names (2-line clamp), size. **List view** — Sortable table (Name, Type, Size, Date, Confidence).
- Click to select, Ctrl+click to toggle. Selection bar with count and batch actions.

### Right-Click Context Menus (`ContextMenu` component in `components/common/`)

- **File**: Open, Open With, Copy File, Copy Path, Move to Folder, Rename (F2), Relocate, Remove from DocRack, Delete from System.
- **Folder**: Open, New Subfolder, Rename, Edit Description, Delete Folder.
- **Background**: New Folder, Upload Files, Upload Folder, Refresh.

### Confirmation Dialogs

- **Remove from DocRack** — Single confirmation (file stays on disk).
- **Delete from System** — Double confirmation: user types exact filename to confirm. Permanently deletes from disk.
- **Delete Folder** — Single confirmation (files become unclassified).
- All dialogs: **Escape** to cancel, **Enter** to confirm.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Delete` | Remove selected file(s) from DocRack |
| `F2` | Rename selected item |
| `Enter` | Open file / navigate into folder |
| `Backspace` | Navigate to parent folder |
| `Escape` | Clear selection |
| `Ctrl+A` | Select all items |
| `Ctrl+C` | Copy selected file to clipboard |

### Drag-and-Drop Upload

- Dragging files over the explorer shows a drop overlay.
- Dropping files opens the Upload Modal with pre-loaded file paths.
- Folder drops are detected and recursively scanned via `file:scan-folder`.

## 21. Design System

For all UI work, read `design-system/docrack/MASTER.md` first.
For page-specific overrides, check `design-system/docrack/pages/<page-name>.md`.
All colors, typography, and spacing must come from the design system tokens.

## 22. AI Development Context

Additional context files (not duplicating this CLAUDE.md):
- `.claude/context/project.md` — Business context, current phase, what's done vs planned
- `.claude/context/features.md` — Feature status tracker (completed / in-progress / planned)

## 23. Commands

Reusable workflows available via `/project:<command>`:
- `/project:analyze-architecture` — Cross-reference codebase against CLAUDE.md
- `/project:build-feature` — Guided feature implementation with guardrails
- `/project:review-security` — Security checklist against Sections 7 and 12
- `/project:refine-ui` — Design system-aligned UI polish

## 24. Skills Reference

Skills are in `.agent/skills/`. Invoke when relevant:
- `@senior-fullstack` — General fullstack patterns
- `@systematic-debugging` — When hunting bugs across layers
- `@react-patterns` — React component architecture
- `@fastapi-pro` — Python API work
- `@ui-ux-pro-max` — UI design decisions and reviews
- `@cc-skill-security-review` — Pre-release security checks
- `@performance-profiling` — Performance debugging
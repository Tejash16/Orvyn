# CLAUDE.md — DocRack Desktop App

This file defines the strict architecture, runtime, and development rules for the DocRack Desktop App.
Claude must read and follow every rule in this file before taking any action on this codebase.

---

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
│   │   ├── pythonProcess.js        # Python process lifecycle
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
│   │   ├── routes/         # Route definitions (auth, health)
│   │   └── services/       # Business logic services
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
- Spawns and manages the Python FastAPI process.
- Handles all IPC (inter-process communication) between React and the system.
- Is the **single source of truth** for runtime config at the desktop layer.

### React (`frontend/`)
- Renders the UI only. No business logic, no file I/O, no direct API calls to Python.
- Receives all runtime configuration through `window.api.getConfig()` (injected by preload).
- Communicates with Electron via IPC (contextBridge methods), not direct Node.js APIs.
- Has no knowledge of local file paths, ports, or environment-specific values.

### Express (`express-backend/`)
- Handles authentication and session management only (cloud-hosted).
- Issues and validates tokens used by other layers.
- Must not contain any document processing, AI, or file system logic.

### Python FastAPI (`python-backend/`)
- Runs locally, spawned by Electron at startup.
- Owns all Smart DataRoom logic: document ingestion, AI processing, embeddings, search.
- Reads its own config from `python-backend/.env`.
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

3. **All runtime configuration must come from Electron.**
   Electron reads `electron/.env` at startup and passes values to React via preload.

4. **Electron reads configuration from `electron/.env`.**
   Use `dotenv` in `electron/main.js`. This file is not committed to git.

5. **Electron exposes configuration via `preload.js` using `contextBridge`.**
   The preload script is the only permitted bridge between the Electron main process
   and the React renderer.

6. **React must access configuration only via `window.api.getConfig()`.**

7. **React must NEVER call Express or Python directly using hardcoded localhost ports.**
   All backend communication must go through Electron IPC unless explicitly approved.

### Correct Pattern

React must never call backend services directly.

Instead, React calls Electron via the preload bridge:

```js
// React component
await window.api.login({ email, password });
```

### Incorrect Pattern — NEVER DO THIS

```js
// WRONG: Vite build-time value, not runtime config
const url = import.meta.env.VITE_EXPRESS_URL;

// WRONG: hardcoded URL
const url = "http://localhost:3000";

// WRONG: process.env is not available in the React renderer
const url = process.env.EXPRESS_URL;
```

---

## 5. Environment Variable Policy

| File                          | Committed | Purpose                                      |
|-------------------------------|-----------|----------------------------------------------|
| `electron/.env`               | No        | Runtime config: URLs, ports, API keys        |
| `electron/.env.example`       | Yes       | Safe template showing required keys          |
| `express-backend/.env`        | No        | Auth secrets, DB connection strings          |
| `express-backend/.env.example`| Yes       | Safe template                                |
| `python-backend/.env`         | No        | Python runtime config, model paths           |
| `python-backend/.env.example` | Yes       | Safe template                                |
| `frontend/.env`               | No        | Vite dev-only (e.g., VITE_DEV_PORT). Never production config. |

Rules:
- Never commit any `.env` file. Only `.env.example` files are committed.
- Never put secrets, tokens, or API keys in `.env.example`.
- Never add `VITE_` prefixed variables that carry production runtime values.
- Config consumed at runtime by React always flows through `electron/.env` → preload → `window.api.getConfig()`.

---

## 6. Git & Security Rules

- `.env` files in all subdirectories are gitignored and must never be committed.
- If you use the any variable from the `.env` file and it does not exist in the `.env.example` add variable there.
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

7. **Reintroduce frontend `.env` usage for production config.** Do not add or suggest
   `VITE_` prefixed environment variables as a solution to runtime configuration needs.

8. **Use `import.meta.env` for runtime values.** This is categorically forbidden in
   production code paths.

9. **Hardcode API URLs, ports, or hostnames** anywhere in the codebase. All such values
   must come from `electron/.env` → preload → `window.api.getConfig()`.

10. **Introduce cross-layer coupling.** React must not import from `electron/`,
    `express-backend/`, or `python-backend/`. Each layer communicates only through its
    defined interface (IPC, HTTP).

11. **Modify `.gitignore`** without explicit user instruction.

12. **Commit secrets or sensitive values** under any circumstances. This includes API keys,
    tokens, passwords, and connection strings.

13. **Remove Windows-only assumptions.** This app targets Windows exclusively. Do not
    introduce cross-platform abstractions (e.g., `path.posix`, `process.platform` guards)
    unless explicitly asked.

14. **Modify or bypass the preload/contextBridge pattern.** Do not suggest using
    `nodeIntegration: true`, `contextIsolation: false`, or direct `require()` calls in
    the renderer as shortcuts.

15. **Auto-generate or scaffold large amounts of boilerplate** without confirmation. Propose
    first, implement after approval.

16. **Rename or reorganize existing source files** without explicit instruction, even if
    the current names seem inconsistent.

17. **Add logging, telemetry, or analytics** of any kind without explicit user approval.

18. **Modify the root `package.json` scripts** without explicit instruction. The `dev`
    script orchestrates all four processes and must not be changed without review.

---

## 8. Windows-Only Assumptions

This application is built exclusively for Windows. The following assumptions are in effect
and must not be changed:

- Windows is the only supported OS.
- Use Node.js `path.join()` and `path.resolve()` for file path handling.
- Do not hardcode path separators (`\\` or `/`) unless absolutely necessary.
- Python process spawning uses `venv\Scripts\activate` and `venv\Scripts\python.exe`.
  Do not substitute with `venv/bin/python` (Unix path).
- Electron's `app.getPath()` calls return Windows paths. Handle them as such.
- Installers and packaging targets (when introduced) are Windows-only: NSIS, Squirrel,
  or similar. Do not add macOS/Linux targets.
- No POSIX shell syntax (`#!/bin/bash`, `&&` chaining in `.sh` scripts) in production
  scripts. Use `.bat`, `.cmd`, or PowerShell where shell scripts are needed.
- SQLite file paths are Windows absolute paths managed by Electron.

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
3. For config-related changes, verify the flow: `electron/.env` → `preload.js` → `window.api.getConfig()`.
4. For dependency changes, ask the user before touching any `package.json` or `requirements.txt`.

### Adding a new feature

1. Determine which layer(s) are responsible (see Section 3).
2. Keep logic in the correct layer. Do not leak business logic into React.
3. Expose new IPC handlers in `electron/main.js` and `electron/preload.js` if React needs
   to trigger backend actions.
4. React calls `window.api.<methodName>()` — never calls Python or Express directly.

### Environment setup for a new machine

1. Copy each `.env.example` to `.env` in the corresponding directory.
2. Fill in the actual values for that machine.
3. Run `npm install` in root, `electron/`, `frontend/`, and `express-backend/`.
4. Run `pip install -r requirements.txt` inside `python-backend/` with the venv activated.
5. Run `npm run dev` from the root.

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

### Redux Persistence Rules

- Only non-sensitive UI preferences may be persisted (e.g., theme).
- Sensitive data (JWT tokens, API keys, secrets) must NEVER be persisted in Redux or localStorage.
- Authentication tokens must be handled securely via Electron runtime or secure storage.

---

## 11. Theme System Rules (Light / Dark)

DocRack supports both Light and Dark themes.

### Theme Architecture

- Default theme is `light` on every application launch.
- Theme state is managed exclusively in Redux (`uiSlice`).
- Theme is applied at the root container level via a `data-theme` attribute on the `app-shell` element.
- All colors must be defined as CSS custom properties (variables) scoped to `[data-theme="light"]` and `[data-theme="dark"]`.
- No component may hardcode color values — all colors must use CSS variables.
- Future UI components must support both light and dark themes from the start.

### Theme Persistence

- Theme must NOT be persisted to `localStorage`.
- Theme must NOT be persisted to any browser storage mechanism.
- Theme persistence will be implemented in a future milestone via SQLite (managed by the Python backend through Electron IPC).
- Until SQLite persistence is implemented, theme always resets to `light` on launch.

### Theme Restrictions

Claude must NOT:

- Implement theme using scattered `useState` across components.
- Hardcode color values inside components or module CSS files.
- Store theme state inside arbitrary components.
- Introduce CSS-in-JS libraries without approval.
- Use `localStorage`, `sessionStorage`, or cookies for theme storage.
- Apply theme at the `document`, `html`, or `body` level — it must apply at the `app-shell` container.

Theme must remain centralized, predictable, and globally controlled.

---

## 12. Additional Security Hardening Rules

Claude must NOT:

- Enable `nodeIntegration` in the Electron renderer.
- Disable `contextIsolation`.
- Use `eval`, `new Function()`, or dynamic script execution.
- Expose Node.js APIs directly to the renderer process.
- Allow React to access filesystem APIs directly.
- Introduce remote code execution patterns.
- Dynamically fetch and execute remote scripts.
- Bypass preload and contextBridge protections.
- Store secrets in memory accessible to the renderer.
- Suggest insecure Electron configuration shortcuts.

All privileged operations must follow this strict flow:
React → preload (contextBridge) → Electron main → Python (if required).

---

## 13. Versioning Policy

- The application version must be defined in `electron/package.json`.
- Follow Semantic Versioning: MAJOR.MINOR.PATCH.
  - MAJOR = breaking changes
  - MINOR = new features
  - PATCH = bug fixes
- Do not modify versioning strategy without explicit instruction.
- Auto-updater implementation (future feature) depends on strict version discipline.

Claude must re-read this file before performing structural or architectural changes.
If a request conflicts with this file, Claude must ask for clarification.

---

## 14. Responsive UI & Window Resizing Rules

DocRack is a desktop application and must support responsive behavior across:

- Different PC screen resolutions (1366x768, 1920x1080, 2K, 4K)
- Manual window resizing by the user

The UI must adapt fluidly without breaking layout.

### Layout Rules

- All major layout containers must use Flexbox or CSS Grid.
- Fixed-width page layouts are prohibited.
- Content areas must use `flex: 1` and avoid hardcoded pixel widths.
- Sidebar must use fixed width with optional collapse behavior, but must not flex-grow.
- Main content area must scroll internally (`overflow: auto`) instead of breaking layout.

### Window Constraints

- Electron window must define `minWidth` and `minHeight`.
- The UI must not rely on extremely small window sizes.
- Layout must remain stable when resized.

### Grid & Card Behavior

- Use responsive grid patterns such as:
  `grid-template-columns: repeat(auto-fit, minmax(Xpx, 1fr))`
- Cards must reflow naturally instead of overlapping or overflowing.

### Typography & Spacing

- Avoid hardcoded large pixel font sizes.
- Prefer relative units (`rem`, `%`, `clamp()`).
- Avoid absolute positioning for layout structure.

### Strict Prohibitions

Claude must NOT:

- Hardcode layout widths (e.g., 1200px containers).
- Use `position: absolute` for core layout structure.
- Use fixed heights that cause overflow clipping.
- Create layouts that only work at one resolution.

Responsive behavior is mandatory for all new UI components and pages.

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

The classification engine lives in `python-backend/app/services/classification_service.py`.

### Processing Pipeline

1. **Text Extraction** — On file registration, the Python backend extracts text from each
   file (PDF via PyPDF2, DOCX via python-docx, XLSX/CSV via openpyxl/csv, PPTX via
   python-pptx, images via OCR, TXT directly). Stores up to 5000 chars in `extracted_text`.

2. **Fingerprinting** — For classification, each file's fingerprint is built from:
   `filename + extension + first 1000 chars of extracted_text`.

3. **Batched Parallel Processing** — Files are split into batches of **10 files per Gemini
   API call**. Up to **5 batches run in parallel** using `asyncio.gather()`, processing
   a maximum of 50 files efficiently.

4. **Folder Assignment** — The AI returns a `folder_id` and `confidence` score (0.0–1.0)
   for each file.

### AI Model Configuration

- **Model**: `gemini-2.0-flash` (Google Generative AI)
- **Temperature**: `0.1` (low variance for consistent classification)
- **Response format**: Structured JSON with `folder_id`, `confidence`, `reasoning`

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

### `ai:*` — AI Classification

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `ai:classify` | `window.api.ai.classify(dataroomId, fileIds)` | Classify files into existing DataRoom folders |
| `ai:generate-dataroom` | `window.api.ai.generateDataroom(name, description, fileIds)` | Create AI-generated DataRoom with folders |

---

## 18. Python Backend Endpoints

All endpoints are defined in `python-backend/app/main.py`. The FastAPI server runs locally,
spawned by Electron. Electron communicates with it via HTTP — React never calls it directly.

### Infrastructure

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check, returns DB table list |
| `POST` | `/init-db` | Initialize SQLite with `database_path` and `mongo_user_id` |

### Theme Settings

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/settings/theme` | Get current theme preference |
| `POST` | `/settings/theme` | Set theme (`"light"` or `"dark"`) |

### DataRoom CRUD

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/datarooms` | Create DataRoom (`name`, optional `description`) |
| `GET` | `/datarooms` | List all DataRooms with `folder_count` and `file_count` |
| `GET` | `/datarooms/{dataroom_id}` | Get DataRoom with nested `folders[]` and `files[]` |
| `PUT` | `/datarooms/{dataroom_id}` | Update DataRoom name/description |
| `DELETE` | `/datarooms/{dataroom_id}` | Delete DataRoom and all children |

### Folder CRUD

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/datarooms/{dataroom_id}/folders` | Create folder (`name`, `context`, optional `parent_id`) |
| `GET` | `/datarooms/{dataroom_id}/folders` | List all folders in DataRoom with `file_count` |
| `PUT` | `/folders/{folder_id}` | Update folder (`name`, `context`, `parent_id`) |
| `DELETE` | `/folders/{folder_id}` | Delete folder (files become unclassified) |

### File Management

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/files/register` | Register files (`dataroom_id`, `file_paths[]`, max 50) |
| `GET` | `/files/{file_id}` | Get file details including `extracted_text` |
| `GET` | `/datarooms/{dataroom_id}/files` | List files with optional `folder_id`, `include_subfolders`, `status` filters |
| `POST` | `/files/{file_id}/check-exists` | Check if file exists at `original_path` |
| `PUT` | `/files/{file_id}/relocate` | Update `original_path` to new location |
| `PUT` | `/files/{file_id}/move-to-folder` | Move file to folder (`folder_id`, null = unclassified) |
| `PUT` | `/files/{file_id}/rename` | Rename display name (`new_name`) |
| `DELETE` | `/files/{file_id}` | Delete file record (query param `delete_from_system=true` also deletes from disk) |

### AI Classification

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/ai/classify` | Classify `file_ids[]` into existing DataRoom folders. Returns per-file `folder_id`, `confidence`, `reasoning` |
| `POST` | `/ai/generate-dataroom` | Create new DataRoom with AI-generated folders, then classify `file_ids[]`. Returns `folders_created`, `files_assigned`, `files_unassigned` |

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

### Virtual File References

- Files are displayed by their `original_name` and metadata from the database.
- Double-clicking a file calls `file:open` which uses `shell.openPath()` to launch the
  system default application.
- If the file no longer exists at `original_path`, the UI shows a "File not found" state
  with a **Relocate** button that opens a file picker to update the stored path.

### Navigation

- **Breadcrumb bar** with clickable path segments for instant navigation to any ancestor.
- **Back/Up buttons** for parent folder navigation.
- **Folder double-click** navigates into the folder.
- Navigation state is managed by `fileExplorerSlice` with `currentPath[]` tracking the
  full breadcrumb trail.

### View Modes

- **Grid view** — Card-based layout with file type icons, names (2-line clamp), and size.
- **List view** — Table with sortable columns (Name, Type, Size, Date, Confidence).
- Toggle between views via toolbar buttons. Persisted in Redux.

### Right-Click Context Menus

Uses the reusable `ContextMenu` component (`frontend/src/components/common/ContextMenu.jsx`).

**File context menu** (11 items):
Open, Open With, separator, Copy File, Copy Path, Move to Folder, separator,
Rename (F2), Relocate, separator, Remove from DocRack, Delete from System.

**Folder context menu** (6 items):
Open, New Subfolder, separator, Rename, Edit Description, separator, Delete Folder.

**Background context menu** (6 items):
New Folder, separator, Upload Files, Upload Folder, separator, Refresh.

### Confirmation Dialogs

- **Remove from DocRack** — Single confirmation. File stays on disk.
- **Delete from System** — Double confirmation: user must type the exact filename to
  enable the delete button. File is permanently deleted from disk.
- **Delete Folder** — Single confirmation. Files inside become unclassified.
- All dialogs support **Escape** to cancel and **Enter** to confirm.

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

### Multi-Selection

- Click to select single item, Ctrl+click to toggle, toolbar "Select All" button.
- Selection bar appears with count and batch action buttons.

### Drag-and-Drop Upload

- Dragging files over the explorer shows a drop overlay.
- Dropping files opens the Upload Modal with pre-loaded file paths.
- Folder drops are detected and recursively scanned via `file:scan-folder`.
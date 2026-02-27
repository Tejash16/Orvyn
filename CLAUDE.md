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
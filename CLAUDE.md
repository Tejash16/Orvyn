# CLAUDE.md — Orvyn Desktop App

This file defines the strict architecture, runtime, and development rules for the Orvyn Desktop App.
Claude must read and follow every rule in this file before taking any action on this codebase.

---

## Layer-Specific Documentation

This file contains cross-cutting rules that apply to all layers. For layer-specific details
(endpoints, IPC channels, Redux slices, etc.), read the relevant file:

| File | Read when working in... | Contents |
|------|------------------------|----------|
| `CLAUDE-ELECTRON.md` | `electron/` | IPC channels, services, Copilot orchestration |
| `CLAUDE-PYTHON.md` | `python-backend/` | Python endpoints, DataRoom architecture, sync rules |
| `CLAUDE-EXPRESS.md` | `express-backend/` | Express endpoints, Gemini integration, MongoDB models |
| `CLAUDE-FRONTEND.md` | `frontend/` | Redux slices, File Explorer, UI architecture, component structure |

When working on a specific layer, read **this file + that layer's file**.

---

## Copilot Feature Guide

Architecture and implementation guide for the Copilot feature: `./DocRack-Copilot-guide.md`

## 1. Project Overview

**Orvyn** is a Windows-only desktop application for intelligent document management.
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
Orvyn/
├── electron/               # Electron main process + preload
│   ├── main.js             # App entry point, lifecycle, IPC, orvyn:// protocol
│   ├── preload.js          # contextBridge API exposed to React
│   ├── package.json        # Electron dependencies
│   ├── ipc/                # IPC handler modules (registered in main.js)
│   │   ├── authHandlers.js         # Auth + Google OAuth + user type IPC
│   │   ├── settingsHandlers.js
│   │   ├── dataroomHandlers.js
│   │   ├── folderHandlers.js
│   │   ├── fileHandlers.js
│   │   ├── aiHandlers.js
│   │   ├── copilotHandlers.js
│   │   ├── organizationHandlers.js  # [V2] Org CRUD, members, invites, audit logs
│   │   ├── billingHandlers.js       # [V2] Upgrade, status, cancel
│   │   ├── sharingHandlers.js       # [V2] Share, import, access management
│   │   └── windowControls.js
│   ├── services/           # Electron-side service modules
│   │   ├── authService.js          # Auth orchestration + Google loopback OAuth
│   │   ├── expressService.js       # Express API communication (incl. org, billing)
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
│   │   │   ├── auth/       # Authentication (Login, Register, GoogleAuth, UserType, OrgSetup)
│   │   │   ├── layout/     # Layout components (Header, Sidebar)
│   │   │   ├── dataroom/   # DataRoom browsing components
│   │   │   ├── upload/     # File upload & classification components
│   │   │   ├── copilot/    # Copilot chat panel components
│   │   │   ├── settings/   # [V2] BillingSettings component
│   │   │   ├── sharing/    # [V2] ShareDialog, SharedWithMe, MyShares
│   │   │   └── common/     # Shared utility components
│   │   ├── pages/          # Page-level components (routed views)
│   │   ├── hooks/          # Custom React hooks
│   │   └── store/          # Redux store, slices, and thunks
│   ├── vite.config.js      # Vite build config (dev only)
│   └── package.json
│
├── express-backend/        # Cloud auth + billing + org server (Node.js + Express)
│   ├── src/
│   │   ├── server.js       # Express app entry point (EJS views, all route mounts)
│   │   ├── config/         # Environment and app configuration
│   │   │   ├── db.js               # MongoDB connection
│   │   │   └── planLimits.js       # [V2] Plan-to-limits mapping (free/pro/enterprise)
│   │   ├── controllers/    # Route handler logic
│   │   │   ├── authController.js
│   │   │   ├── aiController.js
│   │   │   ├── usageController.js
│   │   │   ├── googleAuthController.js   # [V2] Google OAuth endpoints
│   │   │   ├── organizationController.js # [V2] Org CRUD, members, invites
│   │   │   └── sharingController.js      # [V2] DataRoom sharing logic
│   │   ├── middleware/     # Express middleware
│   │   │   ├── authenticate.js     # Bearer token auth
│   │   │   ├── rateLimiter.js      # Rate limiters (auth, org, Google)
│   │   │   ├── errorHandler.js     # Global error handler
│   │   │   ├── orgAuthorize.js     # [V2] Organization role-based access
│   │   │   └── enforceLimits.js    # [V2] Server-side usage enforcement
│   │   ├── models/         # MongoDB schema definitions
│   │   ├── routes/         # Route definitions
│   │   │   ├── auth.js             # Auth + Google auth + user type
│   │   │   ├── ai.js               # AI proxy endpoints
│   │   │   ├── health.js           # Health check
│   │   │   ├── usage.js            # Usage/quota endpoints
│   │   │   ├── organization.js     # [V2] Org API + audit logs
│   │   │   ├── billing.js          # [V2] Razorpay + checkout pages
│   │   │   └── sharing.js          # [V2] Sharing API + user audit logs
│   │   └── services/       # Business logic services
│   │       ├── authService.js      # Auth + Google edge cases
│   │       ├── geminiService.js    # Gemini API calls
│   │       ├── logger.js           # Winston logger
│   │       ├── codeService.js      # Verification code generation
│   │       ├── usageService.js     # Usage tracking
│   │       ├── emailService.js     # [V2] Transactional email (invites, payments)
│   │       ├── emailTemplates.js   # [V2] HTML email templates
│   │       ├── googleAuthService.js # [V2] Google OAuth token exchange
│   │       ├── razorpayService.js  # [V2] Razorpay SDK integration
│   │       └── auditService.js     # [V2] Audit log utility
│   ├── views/              # [V2] EJS templates for checkout
│   │   ├── checkout.ejs
│   │   ├── payment-success.ejs
│   │   └── payment-failure.ejs
│   ├── public/css/          # [V2] Checkout page styles
│   ├── .env                # Auth secrets (NOT committed)
│   └── .env.example
│
├── python-backend/         # Local AI engine (FastAPI)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # FastAPI app (all endpoints incl. sharing export/import)
│   │   └── services/       # Service modules (classification, embedding, chat, tools)
│   ├── run.py              # Startup script
│   ├── requirements.txt    # Python dependencies
│   ├── .env                # Python runtime config (NOT committed)
│   └── .env.example
│
├── package.json            # Root scripts (concurrently runner only)
├── CLAUDE.md               # This file (cross-cutting rules)
├── CLAUDE-ELECTRON.md      # Electron layer reference
├── CLAUDE-PYTHON.md        # Python backend reference
├── CLAUDE-EXPRESS.md       # Express backend reference
└── CLAUDE-FRONTEND.md      # Frontend reference
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

> For IPC channels, service layer details, and Copilot orchestration, see `CLAUDE-ELECTRON.md`.

### React (`frontend/`)
- Renders the UI only. No business logic, no file I/O, no direct API calls to Python.
- Receives all runtime configuration through `window.api.getConfig()` (injected by preload).
- Communicates with Electron via IPC (contextBridge methods), not direct Node.js APIs.
- Has no knowledge of local file paths, ports, or environment-specific values.

> For Redux slices, File Explorer architecture, and component structure, see `CLAUDE-FRONTEND.md`.

### Express (`express-backend/`)
- Handles authentication (email/password + Google OAuth), session management, and AI API proxying (cloud-hosted).
- Issues and validates tokens used by other layers.
- Owns the Gemini API key — all LLM calls are routed through Express so that the
  API key never ships with the desktop application.
- AI proxy endpoints (`/api/v1/ai/*`) require Bearer token authentication.
- Manages organizations, memberships, and invitations (MongoDB).
- Handles billing/subscriptions via Razorpay (plan enforcement, webhook processing, checkout pages).
- Stores shared DataRoom snapshots (folder tree + file metadata + extracted text) for collaboration.
- Tracks enterprise audit logs for compliance.
- Serves EJS checkout pages at `/billing/checkout/*` for Razorpay payment flows.
- Must not contain any document processing or file system logic.

> For Express endpoints, MongoDB models, and Gemini service details, see `CLAUDE-EXPRESS.md`.

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

> For Python endpoints, DataRoom architecture, and sync rules, see `CLAUDE-PYTHON.md`.

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

> For layer-specific environment variables, see the respective `CLAUDE-<LAYER>.md` file.

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
   folders (`electron/`, `frontend/`, `express-backend/`, `python-backend/`).

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
2. Read the main `CLAUDE.md` + the relevant `CLAUDE-<LAYER>.md` file.
3. Confirm the change does not violate any rule in Section 7.
4. For dependency changes, ask the user before touching any `package.json` or `requirements.txt`.

### Adding a new feature

1. Determine which layer(s) are responsible (see Section 3).
2. Keep logic in the correct layer. Do not leak business logic into React.
3. Expose new IPC handlers in `electron/main.js` and `electron/preload.js` if React needs
   to trigger backend actions.
4. React calls `window.api.<methodName>()` — never calls Python or Express directly.

---

## 10. UI Architecture Rules

Redux & Theme architecture rules are defined in `CLAUDE-FRONTEND.md`. All layers must
respect the theme system (CSS custom properties via `data-theme` attribute on `app-shell`).

Key rules that apply everywhere:
- Redux is the only permitted global state manager (no Zustand, MobX, Recoil, etc.).
- No component may hardcode color values — all colors must use CSS variables.
- Theme, sidebar state, or any UI preference must NOT use `localStorage`, `sessionStorage`, or cookies.

> For full Redux rules, persistence rules, and theme architecture, see `CLAUDE-FRONTEND.md`.

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

Claude must NEVER rewrite the React → Electron → Python → Express architecture.
All cross-layer communication must follow the defined flow.

### Rate Limiting

Rate limiter middleware: `express-backend/src/middleware/rateLimiter.js`. All public Express
endpoints must include rate limiting.

> For detailed rate limiter configuration, see `CLAUDE-EXPRESS.md`.

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

Orvyn uses structured, file-based logging across all layers. Logs are essential
for diagnosing issues in packaged builds where there is no console.

### Log Locations

| Layer | Library | Log Path | Rotation |
|-------|---------|----------|----------|
| Electron | `electron-log` | `%APPDATA%/Orvyn/logs/electron.log` | 5 MB, archived with timestamp |
| Python | `logging.handlers.RotatingFileHandler` | Same dir as Electron (via `Orvyn_LOG_DIR` env) | 5 MB, 5 backup files |
| Express | `winston` | `express-backend/logs/express.log` | 5 MB, 5 backup files |

### Architecture

- **Electron** (`electron/services/logger.js`): Wraps `electron-log`. Use `const log = require('./logger')`.
- **Python**: Log directory is passed from Electron via `Orvyn_LOG_DIR` env var. Falls back to `python-backend/logs/` in dev.
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

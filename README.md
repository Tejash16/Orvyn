# Orvyn

> A Windows desktop app for AI-powered document management — combining a local FastAPI engine (RAG search + smart DataRooms), a cloud Express/Gemini backend, and an Electron + React UI.

Orvyn organizes your documents intelligently without ever moving them. Files stay where you put them on disk; Orvyn stores only references, extracts text locally, and uses AI to auto-classify, search, and chat over your document collections.

---

## Features

- **Smart DataRooms** — AI-organized virtual file collections. Files are referenced by path, never copied.
- **AI Auto-Organize & Classification** — Drop in files and let AI build a folder structure or sort them into existing folders.
- **Copilot** — Chat over your documents using hybrid RAG search (vector + keyword), with streaming responses and document comparison.
- **Local-first processing** — Text extraction, indexing, and search all run on your machine. No documents are uploaded for processing.
- **Collaboration & Sharing** — Share DataRoom snapshots with other users (read-only imports).
- **Organizations & Billing** — Team management with role-based access, invites, audit logs, and Razorpay subscriptions.
- **Google & Email Auth** — Sign in with email/password or Google OAuth.
- **Admin Dashboard** — Web-based panel for user management, promo codes, subscriptions, and system health.

---

## Architecture

Orvyn is built as **six decoupled layers**. Electron is the hub — the React UI never talks to backends directly, and all LLM calls route through Express (which alone holds the Gemini API key).

| Layer | Technology | Deployment | Responsibility |
|-------|-----------|------------|----------------|
| **Desktop shell** | Electron (main + preload) | Local (Windows) | App lifecycle, IPC, process orchestration, `orvyn://` protocol |
| **UI** | React + Vite + SWC | Loaded by Electron | Rendering only — communicates via `window.api.*` IPC |
| **AI engine** | Python FastAPI | Local | Document ingestion, text extraction, RAG search, SQLite |
| **Auth / AI proxy** | Express (Node.js) | Cloud | Auth, Gemini API calls, billing, org management, sharing |
| **Web portal** | React + Vite + Tailwind + shadcn/ui | Cloud (`/portal/`) | Invite landing, OAuth callback, checkout |
| **Web admin** | React + Vite + Tailwind + shadcn/ui | Cloud (`/admin/`) | Admin dashboard |
| **Database** | SQLite + ChromaDB | Local | Document metadata, vectors, FTS5 keyword index |

### Data flow

```
React UI  ──IPC──▶  Electron  ──HTTP──▶  Python (local AI engine + SQLite)
                        │
                        └────HTTP──▶  Express (cloud auth + Gemini proxy)
```

**Key principle:** All LLM API keys live only in `express-backend/.env`. They never ship with the desktop app.

---

## Project Structure

```
Orvyn/
├── electron/          # Electron main process, preload, IPC handlers, services
├── frontend/          # React desktop UI (Vite + SWC + Redux)
├── python-backend/    # Local FastAPI AI engine (document processing, RAG, SQLite)
├── express-backend/   # Cloud auth, billing, org, and Gemini AI-proxy server
├── web-portal/        # Public React SPA (invites, OAuth, checkout) — served at /portal/
├── web-admin/         # Admin dashboard React SPA — served at /admin/
└── package.json       # Root dev orchestration (concurrently)
```

---

## Getting Started

### Prerequisites

- **Windows** (this app targets Windows exclusively)
- **Node.js** (LTS)
- **Python 3.x** with a virtual environment in `python-backend/venv/`
- **MongoDB** (for the Express backend)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd Orvyn
   ```

2. **Install dependencies** for each layer:
   ```bash
   npm install
   npm install --prefix frontend
   npm install --prefix electron
   npm install --prefix express-backend
   npm install --prefix web-portal
   npm install --prefix web-admin
   ```

3. **Set up the Python backend:**
   ```bash
   cd python-backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Configure environment variables.** Copy each `.env.example` to `.env` and fill in the values:
   - `electron/.env` — runtime config (URLs, ports, Google client ID)
   - `express-backend/.env` — auth secrets, `MONGO_URI`, `GEMINI_API_KEY`, Razorpay keys
   - `python-backend/.env` — host/port config

   > See [`CLAUDE.md`](CLAUDE.md) Section 5 for the full environment variable policy.

### Running in development

From the project root:

```bash
npm run dev
```

This starts all cloud/UI processes via `concurrently`:
- React desktop UI (Vite) — `frontend/`
- Electron shell — `electron/`
- Express backend — `express-backend/`
- Web portal (port 5174) — `web-portal/`
- Web admin (port 5175) — `web-admin/`

> **Note:** The Python FastAPI engine is spawned automatically by Electron at startup on a dynamically allocated port — it is not started by the root dev script.

---

## Supported File Types

`.pdf` · `.docx` · `.xlsx` · `.pptx` · `.txt` · `.csv` · `.png` · `.jpg` · `.jpeg`

Images are processed via Gemini Vision OCR (routed through Express). Maximum 100 files per classification batch.

---

## Documentation

Architecture and layer-specific rules are documented in the `CLAUDE-*.md` files:

| File | Covers |
|------|--------|
| [`CLAUDE.md`](CLAUDE.md) | Cross-cutting architecture, runtime config, and security rules |
| [`CLAUDE-ELECTRON.md`](CLAUDE-ELECTRON.md) | IPC channels, services, Copilot orchestration |
| [`CLAUDE-PYTHON.md`](CLAUDE-PYTHON.md) | Python endpoints, DataRoom architecture, RAG sync rules |
| [`CLAUDE-EXPRESS.md`](CLAUDE-EXPRESS.md) | Express endpoints, Gemini integration, MongoDB models |
| [`CLAUDE-FRONTEND.md`](CLAUDE-FRONTEND.md) | Redux slices, File Explorer, component structure |
| [`CLAUDE-WEB-PORTAL.md`](CLAUDE-WEB-PORTAL.md) | Portal pages, routing, deep-link protocol |
| [`CLAUDE-WEB-ADMIN.md`](CLAUDE-WEB-ADMIN.md) | Admin pages, auth flow, layout |

---

## License

ISC

# CLAUDE-PYTHON.md — Python Backend Reference

Read this file when working in `python-backend/`. Always read the main `CLAUDE.md` first.

---

## Smart DataRoom Architecture

Orvyn's core feature is the Smart DataRoom — an AI-powered virtual file organizer.

### Virtual File System

- Files are **never copied** into the application. Orvyn stores only the absolute path
  reference (`original_path`) in SQLite. The actual file stays on disk where the user placed it.
- If a file is moved or deleted externally, Orvyn detects this via `file:check-exists` and
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

- Maximum **100 files** per classification batch.
- Nested folder structure with unlimited depth. Each folder node has a `context` field
  (description) that guides the AI classifier.
- File fingerprinting extracts the first **1000 characters** of text content per file for
  AI classification input.

---

## Classification Engine (Python Side)

The classification engine is split across layers for API key security:
- **Data preparation & DB updates** — `python-backend/app/services/classification_service.py`
- **LLM API calls** — handled by Express (see `CLAUDE-EXPRESS.md`)
- **Orchestration** — `electron/ipc/aiHandlers.js` (see `CLAUDE-ELECTRON.md`)

### Processing Pipeline

1. **Text Extraction** — On file registration, the Python backend extracts text from each
   file (PDF via PyMuPDF, DOCX via python-docx, XLSX/CSV via openpyxl/csv, PPTX via
   python-pptx, images via OCR through Express/Gemini Vision, TXT directly). Stores up to 5000 chars in `extracted_text`.

2. **Fingerprinting** — For classification, each file's fingerprint is built from:
   `filename + extension + first 1000 chars of extracted_text`.

3. **Folder Assignment** — The AI returns a `folder_id` and `confidence` score (0.0–1.0)
   for each file.

### Confidence Threshold

- Minimum confidence: **0.4** for folder assignment.
- Files scoring below 0.4 remain **unclassified** (folder_id = null).
- The `classification_score` is stored on the file record and displayed as a colored
  confidence dot in the UI (green >= 0.8, yellow >= 0.6, orange >= 0.4).

---

## Python Backend Endpoints

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
| `GET` | `/api/v1/folders/{folder_id}/delete-preview` | Preview subfolder/file counts before delete |
| `PUT` | `/api/v1/folders/{folder_id}` | Update folder (`name`, `context`, `parent_id`) |
| `DELETE` | `/api/v1/folders/{folder_id}` | Delete folder (query param `file_action` for handling files) |

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

### OCR (Image Text Extraction)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/files/prepare-ocr` | Read image files from disk, base64-encode for Gemini Vision OCR |
| `POST` | `/api/v1/files/apply-ocr` | Store OCR-extracted text in file's `extracted_text` column |

### AI Data Preparation & Result Application

See `CLAUDE-ELECTRON.md` for the full 3-step orchestration flow.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/ai/prepare-classify` | Build fingerprints + folder tree for Gemini classification |
| `POST` | `/api/v1/ai/apply-classify` | Apply Gemini classification results to the database |
| `POST` | `/api/v1/ai/prepare-generate` | Build file fingerprints for Gemini DataRoom generation |
| `POST` | `/api/v1/ai/apply-generate` | Create DataRoom + folders + assignments from Gemini results |

---

## Copilot Python Endpoints

All under `/api/v1/`. Python NEVER calls Gemini directly.

### Indexing Pipeline

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/copilot/prepare-index` | Chunk file text, compute checksums, detect duplicates |
| `POST` | `/api/v1/copilot/apply-index` | Store chunk vectors in ChromaDB + chunks in FTS5 |
| `POST` | `/api/v1/copilot/apply-entities` | Store entities in `file_entities` |
| `POST` | `/api/v1/copilot/apply-summary` | Store `ai_summary` on file record |
| `POST` | `/api/v1/indexing/trigger` | Create `indexing_jobs` for specified files |
| `GET`  | `/api/v1/indexing/status` | Job counts: pending / processing / complete / failed |
| `GET`  | `/api/v1/indexing/pending-files` | List file_ids with pending/processing jobs |
| `POST` | `/api/v1/indexing/retry-failed` | Reset failed jobs to pending |
| `POST` | `/api/v1/indexing/mark-failed` | Mark a specific file's indexing job as failed |

### Search & Chat

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/copilot/prepare-chat` | Prepare chat context: session, hybrid search, history, formatted chunks |
| `POST` | `/api/v1/copilot/search` | Hybrid search: ChromaDB (vector) + FTS5 (keyword), returns top 8 chunks |
| `POST` | `/api/v1/copilot/save-message` | Persist user + assistant messages to SQLite |
| `POST` | `/api/v1/copilot/update-session-title` | Update session title after title generation |
| `POST` | `/api/v1/copilot/check-file-changed` | Run triple-check (size + mtime + checksum) |
| `POST` | `/api/v1/chat/sessions` | Create chat session |
| `GET`  | `/api/v1/chat/sessions` | List sessions (optional scope filter) |
| `GET`  | `/api/v1/chat/sessions/{session_id}/messages` | Get messages for session |
| `DELETE` | `/api/v1/chat/sessions/{session_id}` | Delete session + messages |

### Tool Endpoints (Gemini Function Calling)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/copilot/tool/search` | Tool: `search_documents` |
| `POST` | `/api/v1/copilot/tool/get-file-content` | Tool: `get_file_content` |
| `POST` | `/api/v1/copilot/tool/list-files` | Tool: `list_files` |
| `POST` | `/api/v1/copilot/tool/get-entities` | Tool: `get_entities` |
| `POST` | `/api/v1/copilot/tool/find-similar` | Tool: `find_similar` |
| `POST` | `/api/v1/copilot/tool/prepare-compare` | Prepare file content for comparison tool |
| `POST` | `/api/v1/copilot/prepare-compare` | Prepare structured document content for Gemini comparison |
| `POST` | `/api/v1/copilot/tool/prepare-summarize` | Prepare DataRoom data for summarize tool |
| `POST` | `/api/v1/copilot/tool/prepare-extract` | Prepare chunks for data extraction tool |

### Planned (Not Yet Implemented)

These endpoints are planned for future features:
- `GET /api/v1/chat/suggestions` — Get suggested questions
- `GET /api/v1/chat/insights` — Get DataRoom insights
- `POST /api/v1/copilot/prepare-audit` — Build full DataRoom data for audit/simulation
- `POST /api/v1/copilot/apply-audit` — Save audit/simulation result as chat session
- `POST /api/v1/copilot/prepare-insights` — Build dataroom metadata for insights
- `POST /api/v1/copilot/apply-insights` — Store insights in `dataroom_insights`

### Sharing Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/sharing/export-dataroom` | Export DataRoom snapshot for sharing (folder tree, files, full extracted text, classifications, entities, summaries) |
| `POST` | `/api/v1/sharing/import-dataroom` | Import a shared DataRoom snapshot into local SQLite as a read-only DataRoom |

**Export (`export-dataroom`)** returns:
- `dataroom`: `{ id, name, description }`
- `folderTree`: nested folder structure with context descriptions
- `files[]`: metadata + **full** extracted text (reconstructed from `file_chunks` when available, fallback to truncated `extracted_text` for unindexed files) + AI summary + classification + entities

**Important**: `files.extracted_text` is truncated to 3000 chars at registration. The export endpoint pulls full text from `file_chunks` table (created during indexing) and reconstructs it by removing chunk overlaps via `_reconstruct_text_from_chunks()`.

**Import (`import-dataroom`)** creates:
- A DataRoom marked `is_shared=True` with `[Shared]` prefix in name
- Folder structure mapped from old IDs to new UUIDs
- File records with `original_path='SHARED'` and `is_shared=True`
- Classification and entity records carried over from the snapshot

---

## Sync Function Rules

Vector DB (ChromaDB), FTS5 (`file_chunks`), and SQLite must ALWAYS agree.
Every file or folder mutation that changes state MUST call its corresponding sync function.
These functions live in `python-backend/app/services/embedding_service.py`.

### Endpoint → Sync Function Mapping

| Endpoint | Sync Function Called |
|----------|---------------------|
| `PUT /api/v1/files/{id}/rename` | `sync_file_renamed(file_id, new_name, ...)` |
| `DELETE /api/v1/files/{id}` | `sync_file_removed(file_id, ...)` |
| `PUT /api/v1/files/{id}/move-to-folder` | `sync_file_moved_folder(file_id, new_folder_id, ...)` |
| `PUT /api/v1/files/{id}/relocate` | `has_file_changed()` → if True: `sync_file_content_changed()` |
| `DELETE /api/v1/folders/{id}` | `sync_folder_deleted(folder_id, all_nested_file_ids, ...)` |
| `DELETE /api/v1/datarooms/{id}` | `sync_dataroom_deleted(dataroom_id, ...)` |

### What Each Sync Function Touches

| Function | ChromaDB | file_chunks (FTS5) | file_entities | indexing_jobs | dataroom_insights |
|----------|---------|--------------------|---------------|---------------|-------------------|
| `sync_file_renamed` | Update `file_name` in all chunk metadata | — | — | — | — |
| `sync_file_removed` | Delete all chunks | DELETE | DELETE | DELETE | Mark stale |
| `sync_file_moved_folder` | Update `folder_id` in chunk metadata | — | — | — | Mark stale |
| `sync_file_moved_dataroom` | Update `dataroom_id` + `folder_id` | UPDATE `dataroom_id` | UPDATE `dataroom_id` | — | Mark both stale |
| `sync_folder_deleted` | Delete all chunks for all nested files | DELETE | DELETE | DELETE | Mark stale |
| `sync_dataroom_deleted` | Delete ALL chunks for DataRoom | DELETE | DELETE | DELETE | DELETE + chat sessions |
| `sync_file_content_changed` | Calls `sync_file_removed` then creates new indexing job | via sync_file_removed | via sync_file_removed | New job created | — |

### Principle

> **Vector DB and SQLite must ALWAYS agree.**
> Never delete a file record without calling the appropriate sync function first.
> Never skip the sync functions to "save time" — stale embeddings corrupt search results permanently.

### FTS5 Sync Rule

FTS5 (`file_chunks_fts`) uses `content='file_chunks'` mode with three SQLite triggers
(`file_chunks_ai`, `file_chunks_ad`, `file_chunks_au`). The triggers auto-sync the FTS5 index.
**Never manually INSERT into `file_chunks_fts`** — INSERT/DELETE on `file_chunks` only.

---

## Python Environment Variables

### `python-backend/.env`

| Variable | Default | Purpose |
|----------|---------|---------|
| `PYTHON_HOST` | `127.0.0.1` | Server bind host |
| `PYTHON_PORT` | `8000` | Server bind port (overridden by `--port` CLI arg from Electron) |
| `RAG_CHUNK_SIZE_CHARS` | `3750` | Target size of each text chunk in characters |
| `RAG_CHUNK_OVERLAP_CHARS` | `750` | Overlap between consecutive chunks |
| `RAG_MAX_CHUNKS_PER_QUERY` | `8` | Max chunks returned by hybrid search |
| `RAG_CONFIDENCE_THRESHOLD` | `0.3` | Minimum combined score to include a chunk |
| `RAG_MAX_RETRIEVAL_RESULTS` | `200` | Max raw results fetched before re-ranking |
| `COPILOT_MAX_CHAT_HISTORY` | `10` | Max past messages sent to Gemini per request |
| `COPILOT_MAX_TOOL_ROUNDS` | `3` | Max Gemini function-calling rounds per query |
| `COPILOT_EMBEDDING_BATCH_SIZE` | `50` | Max texts per embed call to Express |
| `COPILOT_SUMMARY_MAX_CHARS` | `2000` | Chars of extracted_text sent for summarization |
| `COPILOT_MAX_CONTEXT_TOKENS` | `8000` | Token budget for document context (approx x 4 chars) |
| `COPILOT_MAX_MESSAGE_LENGTH` | `10000` | Max user message length in characters |
| `OCR_ENABLED` | `true` | Enable OCR for image files |
| `OCR_MAX_IMAGE_SIZE_MB` | `10` | Max image file size for OCR |
| `INDEX_AUTO_ON_CLASSIFY` | `true` | Auto-create indexing jobs after classification |
| `INDEX_EXTRACT_ENTITIES` | `true` | Run entity extraction during indexing |
| `INDEX_GENERATE_SUMMARY` | `true` | Generate AI file summary during indexing |
| `INDEX_MAX_RETRY_ATTEMPTS` | `3` | Max indexing_job retry attempts before `failed` |

---

## SQLite Schema Changes (V2 — Sharing)

The following columns were added to existing SQLite tables for DataRoom sharing support.
Migration logic in the `init-db` endpoint automatically adds these columns if missing.

### `datarooms` table — new columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `is_shared` | `BOOLEAN` | `0` | Whether this DataRoom was imported from a share |
| `shared_from_user_name` | `TEXT` | `NULL` | Name of the user who shared it |
| `shared_dataroom_cloud_id` | `TEXT` | `NULL` | MongoDB ID of the SharedDataRoom record |
| `shared_snapshot_version` | `INTEGER` | `NULL` | Snapshot version number |

### `files` table — new column

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `is_shared` | `BOOLEAN` | `0` | Whether this file belongs to a shared DataRoom |

Shared files have `original_path='SHARED'` (not a real file path) and are **read-only**
in the UI. File operations (open, relocate, delete from system) are disabled for shared files.

### Migration Logic

In the `POST /init-db` endpoint, after Copilot column migrations:
1. Check if `datarooms` table exists → `PRAGMA table_info(datarooms)` → add missing sharing columns via `ALTER TABLE`.
2. Check if `files` table exists → `PRAGMA table_info(files)` → add `is_shared` column if missing.
3. `Base.metadata.create_all(engine)` handles all new tables for fresh databases.


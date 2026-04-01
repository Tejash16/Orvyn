# CLAUDE-ELECTRON.md — Electron Layer Reference

Read this file when working in `electron/`. Always read the main `CLAUDE.md` first.

---

## IPC Channels

All IPC channels are defined in `electron/ipc/` handler files and exposed via
`electron/preload.js` through `contextBridge`. React accesses them via `window.api.*`.

### `auth:*` — Authentication

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `auth:register` | `window.api.auth.register(payload)` | Register new account |
| `auth:login` | `window.api.auth.login(payload)` | Login with email/password |
| `auth:restoreSession` | `window.api.auth.restoreSession()` | Restore session on app launch |
| `auth:logout` | `window.api.auth.logout()` | Logout and revoke token |
| `auth:deleteAccount` | `window.api.auth.deleteAccount(password)` | Delete user account |
| `auth:forgotPassword` | `window.api.auth.forgotPassword(email)` | Request password reset |
| `auth:verifyResetCode` | `window.api.auth.verifyResetCode(email, code)` | Verify reset code validity |
| `auth:resetPassword` | `window.api.auth.resetPassword({ email, code, newPassword })` | Reset password with code |
| `auth:resendResetCode` | `window.api.auth.resendResetCode(email)` | Resend password reset code |
| `auth:verifyEmail` | `window.api.auth.verifyEmail(email, code)` | Verify email with code |
| `auth:resendVerification` | `window.api.auth.resendVerification(email)` | Resend verification email |
| `auth:getCurrentUser` | `window.api.auth.getCurrentUser()` | Get current authenticated user |
| `auth:getLocalDbPath` | `window.api.auth.getLocalDbPath()` | Get local database file path |
| `auth:sendFeedback` | `window.api.auth.sendFeedback(feedback)` | Submit user feedback |

**Push events:**

| Channel | Preload Listener | Purpose |
|---------|-----------------|---------|
| `auth:sessionExpired` | `window.api.auth.onSessionExpired(cb)` | Token expired, force re-login |
| `app:offlineStatus` | `window.api.app.onOfflineStatus(cb)` | Express unreachable notification |

### `settings:*` — Settings

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `settings:setTheme` | `window.api.settings.setTheme(theme)` | Set theme ('light' or 'dark') |
| `settings:getUsage` | `window.api.settings.getUsage()` | Get file usage/quota stats |

### `window:*` — Window Controls

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `window:minimize` | `window.api.window.minimize()` | Minimize window |
| `window:maximize` | `window.api.window.maximize()` | Toggle maximize |
| `window:close` | `window.api.window.close()` | Close window |

**Push events:**

| Channel | Preload Listener | Purpose |
|---------|-----------------|---------|
| `window:maximized` | `window.api.window.onMaximizeChange(cb)` | Window maximize state changed |

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
| `folder:delete-preview` | `window.api.folder.deletePreview(folderId)` | Preview subfolder/file counts before delete |
| `folder:delete` | `window.api.folder.delete(folderId, fileAction)` | Delete folder (with file handling option) |
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
| `file:move-to-folder` | `window.api.file.moveToFolder(fileId, folderId, dataroomId)` | Move file to a different folder |
| `file:rename` | `window.api.file.rename(fileId, newName)` | Rename file display name (not on disk) |
| `file:relocate` | `window.api.file.relocate(fileId)` | Open picker to update path for moved file |
| `file:remove-from-Orvyn` | `window.api.file.removeFromOrvyn(fileId)` | Remove from DB only, keep file on disk |
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
| `ai:generate-dataroom` | `window.api.ai.generateDataroom(name, description, fileIds, dataroomId)` | Create AI-generated DataRoom with folders |

### `app:*` / `logs:*` — App-Level

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `app:getConfig` | `window.api.getConfig()` | Get runtime configuration |
| `app:getLogsPath` | `window.api.logs.getPath()` | Get absolute path to logs directory |
| `app:openLogsFolder` | `window.api.logs.openFolder()` | Open logs folder in Windows Explorer |

---

## Copilot IPC Channels (`copilot:*`)

All channels defined in `electron/ipc/copilotHandlers.js` and exposed via `electron/preload.js`.

### Invoke Channels (`ipcMain.handle`)

| Channel | Preload Method | Purpose |
|---------|---------------|---------|
| `copilot:send-message` | `window.api.copilot.sendMessage(data)` | Full 3-step chat + streaming loop |
| `copilot:cancel-stream` | `window.api.copilot.cancelStream()` | Abort active AbortController |
| `copilot:index-files` | `window.api.copilot.indexFiles({ file_ids, dataroom_id })` | 7-step background indexing pipeline |
| `copilot:get-sessions` | `window.api.copilot.getSessions({ scope_type, scope_id })` | List chat sessions |
| `copilot:get-messages` | `window.api.copilot.getMessages({ session_id })` | Get messages for session |
| `copilot:delete-session` | `window.api.copilot.deleteSession({ session_id })` | Delete session + messages |
| `copilot:get-index-status` | `window.api.copilot.getIndexStatus({ dataroom_id })` | Indexing job status |
| `copilot:retry-indexing` | `window.api.copilot.retryIndexing({ dataroom_id })` | Reset failed jobs to pending |
| `copilot:compare-documents` | `window.api.copilot.compareDocuments({ file_ids })` | Structured document comparison |
| `copilot:check-file-changed` | `window.api.copilot.checkFileChanged({ file_id })` | Triple-check for stale content |

### Planned (Not Yet Implemented)

These channels are planned for future features:
- `copilot:audit-dataroom` — 3-step audit flow
- `copilot:simulate-review` — 3-step role simulation
- `copilot:generate-insights` — 3-step insights generation
- `copilot:get-suggestions` — Get suggested questions
- `copilot:get-insights` — Get cached DataRoom insights

### Push Events (Electron → React, one-way)

| Channel | Preload Listener | Payload | Purpose |
|---------|-----------------|---------|---------|
| `copilot:stream-chunk` | `onStreamChunk` / `offStreamChunk` | `{ text }` | Streaming token from Gemini |
| `copilot:stream-end` | `onStreamEnd` / `offStreamEnd` | `{ sources, session_id }` | Stream complete |
| `copilot:stream-error` | `onStreamError` / `offStreamError` | `{ message }` | Stream or tool error |
| `copilot:stream-reasoning` | `onStreamReasoning` / `offStreamReasoning` | `{ step }` | Tool call reasoning step display |
| `copilot:stream-end-title` | `onTitleUpdate` / `offTitleUpdate` | `{ title }` | Session title generated |
| `copilot:index-progress` | `onIndexProgress` / `offIndexProgress` | `{ completed, total, current_file, status }` | Real-time indexing progress |

---

## Copilot Architecture

The Copilot feature adds document intelligence via hybrid RAG search, streaming
chat, and background indexing. It extends the existing 3-step orchestration
established in the Classification Engine.

### 3-Step Chat Orchestration

```
React → window.api.copilot.sendMessage()
  │ (IPC: copilot:send-message)
  ▼
Electron (copilotHandlers.js)
  Step 1: Express POST /api/v1/ai/embed → embed user query → queryVector
  Step 2: Python POST /api/v1/copilot/search → hybrid search (ChromaDB + FTS5)
           Returns: { formatted_chunks, history, sources, session_id }
  Step 3: Express POST /api/v1/ai/chat/stream → Gemini SSE stream
           Electron reads stream:
             'chunk'          → IPC 'copilot:stream-chunk' to React
             'tool_call'      → Electron executes tool via Python, then loops (max 3 rounds)
             'tool_call_stop' → round complete, continue loop
             'error'          → IPC 'copilot:stream-error' to React
             'end'            → IPC 'copilot:stream-end' to React
  Step 4: Python POST /api/v1/copilot/save-message → persist to SQLite
  Step 5: Express POST /api/v1/ai/generate-title (first message only) → Python updates title
```

**Tool call loop:** Express closes the stream after each `tool_call_stop`. Electron makes a
**new** POST to `/api/v1/ai/chat/stream` with the updated message history appended.
Maximum 3 rounds. On round 3, tools are disabled to force a text response.

For Python endpoints involved in this flow, see `CLAUDE-PYTHON.md`.
For Express endpoints involved, see `CLAUDE-EXPRESS.md`.

### 7-Step Indexing Orchestration

```
Electron (copilotHandlers.js — copilot:index-files)
  For each file_id:
    Step 1: Python POST /api/v1/copilot/prepare-index → { chunks, checksum, is_duplicate }
             If is_duplicate → skip embedding (cost saving)
    Step 2: Express POST /api/v1/ai/embed → { vectors }
    Step 3: Python POST /api/v1/copilot/apply-index → store in ChromaDB + FTS5
    Step 4: Express POST /api/v1/ai/extract-entities → { entities } (best-effort)
    Step 5: Python POST /api/v1/copilot/apply-entities → store in file_entities
    Step 6: Express POST /api/v1/ai/summarize-file → { summary } (best-effort)
    Step 7: Python POST /api/v1/copilot/apply-summary → update files.ai_summary
  IPC 'copilot:index-progress' { completed, total, current_file, status } after each file
```

### Five Architectural Safeguards

| # | Safeguard | Mechanism |
|---|-----------|-----------|
| 1 | **Triple-check file integrity** | `file_size_bytes` + `file_mtime` + `content_checksum` stored per file AND per ChromaDB chunk. Fast stat checks first; expensive SHA-256 last. |
| 2 | **Background indexing queue** | SQLite `indexing_jobs` table. Status: `none→pending→processing→complete→failed`. Decoupled from upload. Up to 3 retries. |
| 3 | **Embedding status protection** | `embedding_status` on every `files` row and every ChromaDB chunk metadata. Search ONLY queries chunks where `embedding_status='complete'`. |
| 4 | **Embedding model versioning** | `embedding_model` stored per file and per chunk. Old-model chunks can be found and deleted selectively on migration. |
| 5 | **Duplicate document detection** | Before embedding, SHA-256 of `extracted_text` is checked. Identical hash = skip embedding, saving API cost and storage. |

### Worker Crash Recovery

On app startup, after `/init-db` completes:
1. Python's `recover_stale_indexing_jobs()` resets any job stuck in `processing` for >10 minutes
   back to `pending`. (`attempts` is NOT incremented — the crash was not the job's fault.)
2. Electron calls `resumePendingIndexing()` (exported from `copilotHandlers.js`), which reads
   pending jobs from Python and triggers `copilot:index-files` in the background automatically.

---

## Electron Service Layer

### `expressService.js` — Express API Communication

| Function | Purpose |
|----------|---------|
| `classifyFiles(fingerprints, folderTree, folderIds, requestId)` | Send classification data to Express/Gemini |
| `generateDataroom(name, description, fingerprints, requestId)` | Send generation data to Express/Gemini |
| `ocrImage(imageBase64, mimeType, filename)` | Send image to Express for Gemini Vision OCR |
| `checkFileLimit(count)` | Pre-check file upload quota with Express |
| `getUsage()` | Get full usage/quota summary from Express |

### `pythonService.js` — Python API Communication

All DataRoom/folder/file CRUD functions plus:

| Function | Purpose |
|----------|---------|
| `prepareOcr(imageFileIds)` | Read image files from disk, prepare for OCR |
| `applyOcr(fileId, extractedText)` | Store OCR-extracted text in file record |
| `deleteFolderPreview(folderId)` | Get subfolder/file counts for delete confirmation |

---

## Electron Environment Variables

### `electron/.env` (Copilot additions)

| Variable | Default | Purpose |
|----------|---------|---------|
| `COPILOT_PANEL_DEFAULT_WIDTH` | `380` | Default panel width in pixels |
| `COPILOT_PANEL_MIN_WIDTH` | `320` | Minimum resizable panel width |
| `COPILOT_PANEL_MAX_WIDTH` | `600` | Maximum resizable panel width |

/**
 * Python Service — runs exclusively in the Electron main process.
 *
 * Responsibilities:
 *   - Make HTTP calls to the local Python FastAPI backend.
 *   - URL is read from PYTHON_URL in electron/.env — never hardcoded.
 *   - Never expose Python responses directly to the renderer.
 */

function getPythonUrl() {
  const url = process.env.PYTHON_URL;
  if (!url) throw new Error('PYTHON_URL is not configured in electron/.env');
  return url;
}

/**
 * Checks that the Python backend is reachable and healthy.
 * Throws if the backend is down or returns a non-2xx status.
 */
async function checkHealth() {
  const res = await fetch(`${getPythonUrl()}/health`);
  if (!res.ok) throw new Error('Python backend health check failed.');
}

/**
 * Calls POST /init-db on the Python backend to create the SQLite database
 * and seed the initial user_meta row for the authenticated user.
 *
 * Both arguments are sourced from main-process state — the renderer
 * cannot supply or influence these values.
 *
 * @param {string} databasePath - Absolute path to the user's SQLite file
 * @param {string} mongoUserId  - MongoDB _id of the authenticated user
 */
async function initDb(databasePath, mongoUserId) {
  const res = await fetch(`${getPythonUrl()}/init-db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      database_path: databasePath,
      mongo_user_id: mongoUserId,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Python /init-db failed.');
  }

  return data;
}

/**
 * Fetches the stored theme from the Python settings table.
 * Returns "light" if no theme has been persisted yet.
 * Requires /init-db to have been called first.
 *
 * @returns {Promise<string>} "light" or "dark"
 */
async function getTheme() {
  const res = await fetch(`${getPythonUrl()}/settings/theme`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to fetch theme from Python.');
  }
  return data.theme;
}

/**
 * Persists a theme value to the Python settings table.
 * The Python endpoint validates the value — only "light" and "dark" are accepted.
 *
 * @param {string} theme - "light" or "dark"
 */
async function setTheme(theme) {
  const res = await fetch(`${getPythonUrl()}/settings/theme`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to persist theme.');
  }

  return data;
}

// ---------------------------------------------------------------------------
// DataRoom CRUD
// ---------------------------------------------------------------------------

async function createDataroom(name, description) {
  const res = await fetch(`${getPythonUrl()}/datarooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to create DataRoom.');
  return data;
}

async function listDatarooms() {
  const res = await fetch(`${getPythonUrl()}/datarooms`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to list DataRooms.');
  return data;
}

async function getDataroom(id) {
  const res = await fetch(`${getPythonUrl()}/datarooms/${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to get DataRoom.');
  return data;
}

async function updateDataroom(id, updates) {
  const res = await fetch(`${getPythonUrl()}/datarooms/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to update DataRoom.');
  return data;
}

async function deleteDataroom(id) {
  const res = await fetch(`${getPythonUrl()}/datarooms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to delete DataRoom.');
  return data;
}

// ---------------------------------------------------------------------------
// Folder CRUD
// ---------------------------------------------------------------------------

async function createFolder(dataroomId, name, context, parentId) {
  const body = { name, context };
  if (parentId != null) body.parent_id = parentId;

  const res = await fetch(
    `${getPythonUrl()}/datarooms/${encodeURIComponent(dataroomId)}/folders`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to create folder.');
  return data;
}

async function listFolders(dataroomId) {
  const res = await fetch(
    `${getPythonUrl()}/datarooms/${encodeURIComponent(dataroomId)}/folders`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to list folders.');
  return data;
}

async function updateFolder(folderId, updates) {
  const res = await fetch(
    `${getPythonUrl()}/folders/${encodeURIComponent(folderId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to update folder.');
  return data;
}

async function deleteFolder(folderId) {
  const res = await fetch(
    `${getPythonUrl()}/folders/${encodeURIComponent(folderId)}`,
    { method: 'DELETE' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to delete folder.');
  return data;
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

async function registerFiles(dataroomId, filePaths) {
  const res = await fetch(`${getPythonUrl()}/files/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataroom_id: dataroomId, file_paths: filePaths }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to register files.');
  return data;
}

async function getFile(fileId) {
  const res = await fetch(
    `${getPythonUrl()}/files/${encodeURIComponent(fileId)}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to get file.');
  return data;
}

async function checkFileExists(fileId) {
  const res = await fetch(
    `${getPythonUrl()}/files/${encodeURIComponent(fileId)}/check-exists`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to check file existence.');
  return data;
}

async function relocateFile(fileId, newPath) {
  const res = await fetch(
    `${getPythonUrl()}/files/${encodeURIComponent(fileId)}/relocate`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_path: newPath }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to relocate file.');
  return data;
}

async function moveFileToFolder(fileId, folderId) {
  const res = await fetch(
    `${getPythonUrl()}/files/${encodeURIComponent(fileId)}/move-to-folder`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to move file to folder.');
  return data;
}

async function deleteFile(fileId, deleteFromSystem) {
  const qs = deleteFromSystem ? '?delete_from_system=true' : '?delete_from_system=false';
  const res = await fetch(
    `${getPythonUrl()}/files/${encodeURIComponent(fileId)}${qs}`,
    { method: 'DELETE' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to delete file.');
  return data;
}

async function listFiles(dataroomId, options = {}) {
  const params = new URLSearchParams();
  if (options.folder_id != null)        params.set('folder_id', options.folder_id);
  if (options.include_subfolders)        params.set('include_subfolders', 'true');
  if (options.status)                    params.set('status', options.status);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(
    `${getPythonUrl()}/datarooms/${encodeURIComponent(dataroomId)}/files${qs}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to list files.');
  return data;
}

async function renameFile(fileId, newName) {
  const res = await fetch(
    `${getPythonUrl()}/files/${encodeURIComponent(fileId)}/rename`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: newName }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to rename file.');
  return data;
}

// ---------------------------------------------------------------------------
// AI operations
// ---------------------------------------------------------------------------

async function classifyFiles(dataroomId, fileIds) {
  const res = await fetch(`${getPythonUrl()}/ai/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataroom_id: dataroomId, file_ids: fileIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'AI classification failed.');
  return data;
}

async function generateDataroom(name, description, fileIds) {
  const res = await fetch(`${getPythonUrl()}/ai/generate-dataroom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataroom_name: name,
      dataroom_description: description,
      file_ids: fileIds,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'AI DataRoom generation failed.');
  return data;
}

module.exports = {
  checkHealth,
  initDb,
  getTheme,
  setTheme,
  // DataRoom
  createDataroom,
  listDatarooms,
  getDataroom,
  updateDataroom,
  deleteDataroom,
  // Folder
  createFolder,
  listFolders,
  updateFolder,
  deleteFolder,
  // File
  registerFiles,
  getFile,
  checkFileExists,
  relocateFile,
  moveFileToFolder,
  deleteFile,
  listFiles,
  renameFile,
  // AI
  classifyFiles,
  generateDataroom,
};

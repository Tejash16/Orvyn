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

module.exports = { checkHealth, initDb, getTheme, setTheme };

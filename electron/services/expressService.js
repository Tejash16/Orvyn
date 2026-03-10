/**
 * Express Service — runs exclusively in the Electron main process.
 *
 * Responsibilities:
 *   - Make authenticated HTTP calls to the Express cloud backend.
 *   - Used for AI proxy endpoints (Gemini calls routed through Express).
 *   - Access token is sourced from authService — never from the renderer.
 */

const authService = require('./authService');

function getExpressUrl() {
  const url = process.env.EXPRESS_URL;
  if (!url) throw new Error('EXPRESS_URL is not configured in electron/.env');
  return url;
}

/**
 * Sends prepared file data to Express for AI classification via Gemini.
 * Express holds the Gemini API key — it never reaches the desktop app.
 *
 * @param {Array}    fingerprints - File fingerprint objects from Python
 * @param {string}   folderTree   - Folder tree text from Python
 * @param {string[]} folderIds    - Valid folder IDs from Python
 * @returns {Promise<Array>} Classification results from Gemini
 */
async function classifyFiles(fingerprints, folderTree, folderIds) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/ai/classify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fingerprints,
      folder_tree: folderTree,
      folder_ids: folderIds,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI classification failed.');
  return data.results;
}

/**
 * Sends prepared file data to Express for AI DataRoom generation via Gemini.
 * Express holds the Gemini API key — it never reaches the desktop app.
 *
 * @param {string} name         - DataRoom name
 * @param {string} description  - DataRoom description
 * @param {Array}  fingerprints - File fingerprint objects from Python
 * @returns {Promise<Object>} Gemini result with folders and assignments
 */
async function generateDataroom(name, description, fingerprints) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/ai/generate-dataroom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      dataroom_name: name,
      dataroom_description: description,
      fingerprints,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI DataRoom generation failed.');
  return data.gemini_result;
}

module.exports = { classifyFiles, generateDataroom };

/**
 * Express Service — runs exclusively in the Electron main process.
 *
 * Responsibilities:
 *   - Make authenticated HTTP calls to the Express cloud backend.
 *   - Used for AI proxy endpoints (Gemini calls routed through Express).
 *   - Access token is sourced from authService — never from the renderer.
 */

const authService = require('./authService');
const config      = require('../config');

function getExpressUrl() {
  return config.EXPRESS_URL;
}

/**
 * Sends prepared file data to Express for AI classification via Gemini.
 * Express holds the Gemini API key — it never reaches the desktop app.
 *
 * @param {Array}    fingerprints - File fingerprint objects from Python
 * @param {string}   folderTree   - Folder tree text from Python
 * @param {string[]} folderIds    - Valid folder IDs from Python
 * @param {string}   requestId    - Idempotency key for usage tracking
 * @returns {Promise<Array>} Classification results from Gemini
 */
async function classifyFiles(fingerprints, folderTree, folderIds, requestId) {
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
      requestId,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'AI classification failed.');
    if (data.code) err.code = data.code;
    if (data.upgradeRequired) err.upgradeRequired = true;
    throw err;
  }
  return data.results;
}

/**
 * Sends prepared file data to Express for AI DataRoom generation via Gemini.
 * Express holds the Gemini API key — it never reaches the desktop app.
 *
 * @param {string} name         - DataRoom name
 * @param {string} description  - DataRoom description
 * @param {Array}  fingerprints - File fingerprint objects from Python
 * @param {string} requestId    - Idempotency key for usage tracking
 * @returns {Promise<Object>} Gemini result with folders and assignments
 */
async function generateDataroom(name, description, fingerprints, requestId) {
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
      requestId,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'AI DataRoom generation failed.');
    if (data.code) err.code = data.code;
    if (data.upgradeRequired) err.upgradeRequired = true;
    throw err;
  }
  return data.gemini_result;
}

/**
 * Pre-check file upload capacity against usage limits.
 * Advisory only — hard enforcement is in the classify endpoint.
 *
 * @param {number} count - Number of files the user wants to upload
 * @returns {Promise<{ allowed, current, limit, remaining, resetsAt }>}
 */
async function checkFileLimit(count) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/usage/check-files?count=${count}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Usage check failed.');
  return data;
}

/**
 * Fetch full usage summary for the Settings page.
 *
 * @returns {Promise<{ usage: { files: {...}, messages: {...} } }>}
 */
async function getUsage() {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/usage`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch usage.');
  return data;
}

/**
 * Send a base64-encoded image to Express for OCR via Gemini Vision.
 *
 * @param {string} imageBase64 - Base64-encoded image bytes
 * @param {string} mimeType    - Image MIME type (image/png, image/jpeg)
 * @param {string} filename    - Original filename
 * @returns {Promise<string>} Extracted text from the image
 */
async function ocrImage(imageBase64, mimeType, filename) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/ai/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      image_base64: imageBase64,
      mime_type: mimeType,
      filename,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'OCR failed.');
  return data.extracted_text;
}

/**
 * Fetch plan, limits, and current usage for the authenticated user.
 *
 * @returns {Promise<{ plan, limits: { dataroomLimit, monthlyFileLimit, dailyMessageLimit }, usage: { filesUploadedThisPeriod, messagesToday } }>}
 */
async function getLimits() {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/usage/limits`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch limits.');
  return data;
}

/**
 * Set user type (individual or enterprise) after first login.
 *
 * @param {string} userType - 'individual' or 'enterprise'
 * @returns {Promise<{ success, user }>}
 */
async function setUserType(userType) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/auth/set-user-type`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userType }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to set user type.');
  return data;
}

// ── Organization API ──────────────────────────────────────

async function createOrganization(name) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create organization.');
  return data;
}

async function getOrganization(orgId) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/${orgId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch organization.');
  return data;
}

async function updateOrganization(orgId, updates) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/${orgId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update organization.');
  return data;
}

async function deleteOrganization(orgId) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/${orgId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete organization.');
  return data;
}

async function getOrgMembers(orgId) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/${orgId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch members.');
  return data;
}

async function updateMemberRole(orgId, userId, role) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/${orgId}/members/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update member role.');
  return data;
}

async function removeOrgMember(orgId, userId) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/${orgId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to remove member.');
  return data;
}

async function createOrgInvite(orgId, email, role) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/${orgId}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, role }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create invite.');
  return data;
}

async function listOrgInvites(orgId) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/${orgId}/invites`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch invites.');
  return data;
}

async function revokeOrgInvite(orgId, inviteId) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/${orgId}/invites/${inviteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to revoke invite.');
  return data;
}

async function acceptOrgInvite(inviteCode) {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');

  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/invites/${inviteCode}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to accept invite.');
  return data;
}

async function getInviteDetails(inviteCode) {
  // Public endpoint — no auth needed
  const res = await fetch(`${getExpressUrl()}/api/v1/organizations/invites/${inviteCode}`);

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch invite details.');
  return data;
}

module.exports = {
  getExpressUrl,
  classifyFiles,
  generateDataroom,
  checkFileLimit,
  getUsage,
  ocrImage,
  getLimits,
  setUserType,
  // Organization
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  getOrgMembers,
  updateMemberRole,
  removeOrgMember,
  createOrgInvite,
  listOrgInvites,
  revokeOrgInvite,
  acceptOrgInvite,
  getInviteDetails,
};

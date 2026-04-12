'use strict';

const authService    = require('../services/authService');
const expressService = require('../services/expressService');
const log            = require('../services/logger');

// Small wrapper: send Bearer-authenticated JSON request to Express and
// return the parsed body. On network error, returns { error: <message> }.
async function apiRequest(method, pathSuffix, body) {
  try {
    const token = authService.getToken();
    const res = await fetch(`${expressService.getExpressUrl()}/api/v1/collaborations${pathSuffix}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
  } catch (err) {
    log.error(`collaboration ${method} ${pathSuffix} failed:`, err.message);
    return { error: err.message };
  }
}

function registerCollaborationHandlers(ipcMain) {
  ipcMain.handle('collaboration:list', () => apiRequest('GET', ''));
  ipcMain.handle('collaboration:suggestions', () => apiRequest('GET', '/suggestions'));
  ipcMain.handle('collaboration:request', (_e, { email }) => apiRequest('POST', '', { email }));
  ipcMain.handle('collaboration:accept', (_e, { id }) => apiRequest('POST', `/${id}/accept`));
  ipcMain.handle('collaboration:reject', (_e, { id }) => apiRequest('POST', `/${id}/reject`));
  ipcMain.handle('collaboration:remove', (_e, { id }) => apiRequest('DELETE', `/${id}`));
}

module.exports = { registerCollaborationHandlers };

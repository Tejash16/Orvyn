'use strict';

const authService    = require('../services/authService');
const expressService = require('../services/expressService');
const log            = require('../services/logger');

async function apiRequest(method, pathSuffix) {
  try {
    const token = authService.getToken();
    const res = await fetch(`${expressService.getExpressUrl()}/api/v1/notifications${pathSuffix}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  } catch (err) {
    log.error(`notifications ${method} ${pathSuffix} failed:`, err.message);
    return { error: err.message };
  }
}

function registerNotificationHandlers(ipcMain) {
  ipcMain.handle('notification:list', async (_e, { since, unread } = {}) => {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (unread) params.set('unread', 'true');
    const qs = params.toString();
    return apiRequest('GET', qs ? `/?${qs}` : '/');
  });

  ipcMain.handle('notification:markRead', (_e, { id }) => apiRequest('POST', `/${id}/read`));
  ipcMain.handle('notification:markAllRead', () => apiRequest('POST', '/read-all'));
}

module.exports = { registerNotificationHandlers };

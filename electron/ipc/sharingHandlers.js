'use strict';

const authService    = require('../services/authService');
const expressService = require('../services/expressService');
const log            = require('../services/logger');

function getPythonUrl() {
  const url = process.env.PYTHON_URL;
  if (!url) throw new Error('PYTHON_URL is not configured');
  return url;
}

/**
 * Registers sharing-related IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 */
function registerSharingHandlers(ipcMain, getMainWindow) {

  // Share a DataRoom with a user
  ipcMain.handle('sharing:shareDataroom', async (event, { dataroomId, recipientEmail }) => {
    try {
      // Step 1: Export snapshot from Python
      const snapshotRes = await fetch(`${getPythonUrl()}/api/v1/sharing/export-dataroom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataroom_id: dataroomId }),
      });
      const snapshot = await snapshotRes.json();
      if (!snapshotRes.ok) throw new Error(snapshot.detail || 'Export failed');

      // Step 2: Send snapshot to Express
      const token = authService.getToken();
      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/sharing/datarooms`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDataroomId: dataroomId,
          name: snapshot.dataroom.name,
          description: snapshot.dataroom.description,
          folderTree: snapshot.folderTree,
          files: snapshot.files,
          recipientEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Share failed');
      return data;
    } catch (error) {
      log.error('Share DataRoom failed:', error);
      return { error: error.message };
    }
  });

  // List DataRooms shared with me
  ipcMain.handle('sharing:getReceived', async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/sharing/received`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (error) {
      log.error('Get received shares failed:', error);
      return { received: [] };
    }
  });

  // Import shared DataRoom into local SQLite
  ipcMain.handle('sharing:importDataroom', async (event, { shareId }) => {
    try {
      // Step 1: Get full snapshot from Express
      const token = authService.getToken();
      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/sharing/received/${shareId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch shared DataRoom');
      const { sharedDataRoom } = data;

      // Step 2: Import into local SQLite via Python
      const importRes = await fetch(`${getPythonUrl()}/api/v1/sharing/import-dataroom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: sharedDataRoom }),
      });
      const result = await importRes.json();
      if (!importRes.ok) throw new Error(result.detail || 'Import failed');

      return result;
    } catch (error) {
      log.error('Import shared DataRoom failed:', error);
      return { error: error.message };
    }
  });

  // Search users for sharing
  ipcMain.handle('sharing:searchUsers', async (event, { query }) => {
    try {
      const token = authService.getToken();
      const res = await fetch(
        `${expressService.getExpressUrl()}/api/v1/sharing/users/search?q=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      return await res.json();
    } catch (error) {
      return { users: [] };
    }
  });

  // Update shared DataRoom (re-share with latest data)
  ipcMain.handle('sharing:updateShare', async (event, { shareId, dataroomId }) => {
    try {
      // Re-export from Python
      const snapshotRes = await fetch(`${getPythonUrl()}/api/v1/sharing/export-dataroom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataroom_id: dataroomId }),
      });
      const snapshot = await snapshotRes.json();
      if (!snapshotRes.ok) throw new Error(snapshot.detail || 'Export failed');

      // Update on Express
      const token = authService.getToken();
      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/sharing/datarooms/${shareId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderTree: snapshot.folderTree,
          files: snapshot.files,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      return data;
    } catch (error) {
      return { error: error.message };
    }
  });

  // List my shared DataRooms
  ipcMain.handle('sharing:getMyShares', async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/sharing/my-shares`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (error) {
      return { shares: [] };
    }
  });

  // Delete shared DataRoom
  ipcMain.handle('sharing:deleteShare', async (event, { shareId }) => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/sharing/datarooms/${shareId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (error) {
      return { error: error.message };
    }
  });

  // Grant access to a user
  ipcMain.handle('sharing:grantAccess', async (event, { shareId, email, permission }) => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/sharing/datarooms/${shareId}/access`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, permission }),
      });
      return await res.json();
    } catch (error) {
      return { error: error.message };
    }
  });

  // Revoke user access
  ipcMain.handle('sharing:revokeAccess', async (event, { shareId, userId }) => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/sharing/datarooms/${shareId}/access/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (error) {
      return { error: error.message };
    }
  });

  // List access for a shared DataRoom
  ipcMain.handle('sharing:listAccess', async (event, { shareId }) => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/sharing/datarooms/${shareId}/access`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (error) {
      return { accesses: [] };
    }
  });
}

module.exports = { registerSharingHandlers };

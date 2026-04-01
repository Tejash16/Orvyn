const pythonService  = require('../services/pythonService');
const expressService = require('../services/expressService');

/**
 * Registers DataRoom IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 */
function registerDataroomHandlers(ipcMain) {

  ipcMain.handle('dataroom:create', async (_event, { name, description }) => {
    try {
      // ── Check DataRoom limit before creation ──────────────
      try {
        const limitsData = await expressService.getLimits();
        const dataroomLimit = limitsData.limits?.dataroomLimit ?? 3;

        if (dataroomLimit !== -1) {
          const dataroomsResult = await pythonService.listDatarooms();
          const currentCount = Array.isArray(dataroomsResult) ? dataroomsResult.length : 0;

          if (currentCount >= dataroomLimit) {
            return {
              success: false,
              error: `Free plan allows up to ${dataroomLimit} DataRooms. Upgrade to Pro for unlimited.`,
              upgradeRequired: true,
            };
          }
        }
      } catch (limitErr) {
        // Limit check failure should not block creation — proceed
      }

      const data = await pythonService.createDataroom(name, description);
      return { success: true, dataroom: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dataroom:list', async () => {
    try {
      const data = await pythonService.listDatarooms();
      return { success: true, datarooms: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dataroom:get', async (_event, { id }) => {
    try {
      const data = await pythonService.getDataroom(id);
      return { success: true, dataroom: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dataroom:update', async (_event, { id, updates }) => {
    try {
      const data = await pythonService.updateDataroom(id, updates);
      return { success: true, dataroom: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dataroom:delete', async (_event, { id }) => {
    try {
      const data = await pythonService.deleteDataroom(id);
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

}

module.exports = registerDataroomHandlers;

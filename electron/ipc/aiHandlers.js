const pythonService = require('../services/pythonService');

/**
 * Registers AI classification IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 */
function registerAiHandlers(ipcMain) {

  ipcMain.handle('ai:classify', async (_event, { dataroom_id, file_ids }) => {
    try {
      const data = await pythonService.classifyFiles(dataroom_id, file_ids);
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ai:generate-dataroom', async (_event, { dataroom_name, dataroom_description, file_ids }) => {
    try {
      const data = await pythonService.generateDataroom(dataroom_name, dataroom_description, file_ids);
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

}

module.exports = registerAiHandlers;

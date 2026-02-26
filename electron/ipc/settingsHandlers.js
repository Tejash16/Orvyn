const pythonService = require('../services/pythonService');

/**
 * Registers settings-related IPC handlers.
 *
 * All theme values are validated inside the Python backend before
 * touching the database. The renderer supplies only the theme string —
 * it cannot influence the database path or any other state.
 *
 * @param {Electron.IpcMain} ipcMain
 */
function registerSettingsHandlers(ipcMain) {

  ipcMain.handle('settings:setTheme', async (_event, theme) => {
    try {
      await pythonService.setTheme(theme);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

}

module.exports = registerSettingsHandlers;

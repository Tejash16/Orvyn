const pythonService  = require('../services/pythonService');
const expressService = require('../services/expressService');

/**
 * Registers AI classification IPC handlers.
 *
 * AI flow (3-step orchestration):
 *   1. Python prepares data (fingerprints, folder tree) from local SQLite
 *   2. Express calls Gemini (holds the API key server-side)
 *   3. Python applies AI results back to the database
 *
 * The Gemini API key never touches the desktop app.
 *
 * @param {Electron.IpcMain} ipcMain
 */
function registerAiHandlers(ipcMain) {

  ipcMain.handle('ai:classify', async (_event, { dataroom_id, file_ids }) => {
    try {
      const startTime = Date.now();

      // Step 1: Python prepares fingerprints + folder tree from local DB
      const prepared = await pythonService.prepareClassify(dataroom_id, file_ids);

      // Step 2: Express calls Gemini with the prepared data (API key stays server-side)
      const results = await expressService.classifyFiles(
        prepared.fingerprints,
        prepared.folder_tree,
        prepared.folder_ids,
      );

      // Step 3: Python applies the AI results to the local database
      const applied = await pythonService.applyClassifyResults(dataroom_id, results);

      return {
        success: true,
        status: applied.status,
        dataroom_id: applied.dataroom_id,
        total_files: file_ids.length,
        classified: applied.classified,
        low_confidence_skipped: applied.low_confidence_skipped,
        missing_file_ids: prepared.missing_file_ids,
        time_seconds: (Date.now() - startTime) / 1000,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ai:generate-dataroom', async (_event, { dataroom_name, dataroom_description, file_ids, dataroom_id }) => {
    try {
      const startTime = Date.now();

      // Step 1: Python prepares file fingerprints from local DB
      const prepared = await pythonService.prepareGenerate(file_ids);

      // Step 2: Express calls Gemini to generate folder structure + assignments
      const geminiResult = await expressService.generateDataroom(
        dataroom_name,
        dataroom_description,
        prepared.fingerprints,
      );

      // Step 3: Python creates DataRoom, folders, and assigns files in local DB
      const applied = await pythonService.applyGenerateResults(
        dataroom_name,
        dataroom_description,
        geminiResult,
        file_ids,
        dataroom_id,
      );

      return {
        success: true,
        ...applied,
        missing_file_ids: prepared.missing_file_ids,
        time_seconds: (Date.now() - startTime) / 1000,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

}

module.exports = registerAiHandlers;

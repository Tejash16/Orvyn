/**
 * AI Controller — Express backend.
 *
 * Receives prepared data from Electron (fingerprints, folder trees),
 * calls Gemini via geminiService, and returns raw AI results.
 * Database updates happen in the Python backend — Express never touches SQLite.
 */

const geminiService = require('../services/geminiService');

// ── Classify files into existing folders ─────────────────

async function classify(req, res, next) {
  try {
    const { fingerprints, folder_tree, folder_ids } = req.body;

    if (!fingerprints || !Array.isArray(fingerprints) || fingerprints.length === 0) {
      return res.status(400).json({ success: false, error: 'fingerprints array is required and must not be empty.' });
    }

    if (!folder_tree || typeof folder_tree !== 'string') {
      return res.status(400).json({ success: false, error: 'folder_tree string is required.' });
    }

    if (!folder_ids || !Array.isArray(folder_ids) || folder_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'folder_ids array is required and must not be empty.' });
    }

    if (fingerprints.length > 50) {
      return res.status(400).json({ success: false, error: 'Maximum 50 files per classification request.' });
    }

    const results = await geminiService.classifyFiles(fingerprints, folder_tree, folder_ids);

    return res.status(200).json({ success: true, results });
  } catch (err) {
    next(err);
  }
}

// ── Generate DataRoom structure ──────────────────────────

async function generateDataroom(req, res, next) {
  try {
    const { dataroom_name, dataroom_description, fingerprints } = req.body;

    if (!dataroom_name || typeof dataroom_name !== 'string' || !dataroom_name.trim()) {
      return res.status(400).json({ success: false, error: 'dataroom_name is required.' });
    }

    if (!fingerprints || !Array.isArray(fingerprints) || fingerprints.length === 0) {
      return res.status(400).json({ success: false, error: 'fingerprints array is required and must not be empty.' });
    }

    if (fingerprints.length > 50) {
      return res.status(400).json({ success: false, error: 'Maximum 50 files per generation request.' });
    }

    const geminiResult = await geminiService.generateDataroom(
      dataroom_name.trim(),
      dataroom_description || '',
      fingerprints,
    );

    return res.status(200).json({ success: true, gemini_result: geminiResult });
  } catch (err) {
    next(err);
  }
}

module.exports = { classify, generateDataroom };

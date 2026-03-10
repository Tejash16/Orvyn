const { Router } = require('express');
const {
  classify,
  generateDataroom,
  embed,
  extractEntities,
  summarizeFile,
  generateTitle,
} = require('../controllers/aiController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

// All AI endpoints require authentication — only logged-in users
// can consume Gemini API quota through the Express proxy.
router.post('/classify',          authenticate, classify);
router.post('/generate-dataroom', authenticate, generateDataroom);

// Copilot endpoints (V1 Copilot)
router.post('/embed',             authenticate, embed);
router.post('/extract-entities',  authenticate, extractEntities);
router.post('/summarize-file',    authenticate, summarizeFile);
router.post('/generate-title',    authenticate, generateTitle);

module.exports = router;

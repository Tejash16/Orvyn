const { Router } = require('express');
const {
  classify,
  generateDataroom,
  embed,
  extractEntities,
  summarizeFile,
  generateTitle,
  // Phase C2
  chatStream,
  chat,
  auditDataroom,
  simulateRole,
  insightsGenerate,
  suggestionsGenerate,
} = require('../controllers/aiController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

// All AI endpoints require authentication — only logged-in users
// can consume Gemini API quota through the Express proxy.
router.post('/classify', authenticate, classify);
router.post('/generate-dataroom', authenticate, generateDataroom);

// Copilot endpoints (V1 Copilot)
router.post('/embed', authenticate, embed);
router.post('/extract-entities', authenticate, extractEntities);
router.post('/summarize-file', authenticate, summarizeFile);
router.post('/generate-title', authenticate, generateTitle);

// Phase C2 — Chat, Audit, Simulation, Insights
router.post('/chat/stream', authenticate, chatStream);
router.post('/chat', authenticate, chat);
router.post('/audit', authenticate, auditDataroom);
router.post('/simulate', authenticate, simulateRole);
router.post('/generate-insights', authenticate, insightsGenerate);
router.post('/generate-suggestions', authenticate, suggestionsGenerate);

module.exports = router;

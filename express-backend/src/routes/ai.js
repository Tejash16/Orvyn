const { Router } = require('express');
const {
  classify,
  generateDataroom,
  hybridOrganize,
  embed,
  extractEntities,
  ocrImage,
  summarizeFile,
  generateTitle,
  chatStream,
  chat,
} = require('../controllers/aiController');
const { authenticate } = require('../middleware/authenticate');
const enforceLimits = require('../middleware/enforceLimits');

const router = Router();

// All AI endpoints require authentication — only logged-in users
// can consume Gemini API quota through the Express proxy.

// Classification — enforce file limit (count fingerprints in the batch)
router.post('/classify', authenticate, enforceLimits('file', (req) => {
  return req.body.fingerprints?.length || 0;
}), classify);

// Generate DataRoom — enforce dataroom limit
router.post('/generate-dataroom', authenticate, enforceLimits('dataroom'), generateDataroom);

// Hybrid organize — AI mode into an existing DataRoom. Counts files, no new DR created.
router.post('/hybrid-organize', authenticate, enforceLimits('file', (req) => {
  return req.body.fingerprints?.length || 0;
}), hybridOrganize);

// OCR via Gemini Vision
router.post('/ocr', authenticate, ocrImage);

// Copilot endpoints (V1 Copilot)
router.post('/embed', authenticate, embed);
router.post('/extract-entities', authenticate, extractEntities);
router.post('/summarize-file', authenticate, summarizeFile);
router.post('/generate-title', authenticate, generateTitle);

// Chat — enforce daily message limit
router.post('/chat/stream', authenticate, enforceLimits('message'), chatStream);
router.post('/chat', authenticate, enforceLimits('message'), chat);

module.exports = router;


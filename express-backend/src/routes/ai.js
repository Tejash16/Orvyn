const { Router } = require('express');
const { classify, generateDataroom } = require('../controllers/aiController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

// All AI endpoints require authentication — only logged-in users
// can consume Gemini API quota through the Express proxy.
router.post('/classify',          authenticate, classify);
router.post('/generate-dataroom', authenticate, generateDataroom);

module.exports = router;

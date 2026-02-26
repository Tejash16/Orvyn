const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const loginLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: 'Too many login attempts. Try again in 15 minutes.' });
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: 'Too many requests. Try again in 15 minutes.' });
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: 'Too many attempts. Try again in 15 minutes.' });
  },
});

module.exports = { loginLimiter, forgotPasswordLimiter, resetPasswordLimiter };

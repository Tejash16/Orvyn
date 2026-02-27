const { Router } = require('express');
const {
  register,
  verifyEmail,
  login,
  getMe,
  refreshTokens,
  logoutHandler,
  deleteAccount,
  resendVerification,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');
const { loginLimiter, forgotPasswordLimiter, resetPasswordLimiter, resendVerificationLimiter } = require('../middleware/rateLimiter');

const router = Router();

router.post('/register',     register);
router.post('/verify-email', verifyEmail);
router.post('/login',        loginLimiter, login);

// Stateless access-token validation — used by Electron for guard checks.
router.get('/me',            authenticate, getMe);

// Rotate refresh token → issue new access + refresh tokens.
// No auth middleware — accepts a refresh token in the body.
router.post('/refresh',      refreshTokens);

// Server-side refresh-token revocation. No auth middleware required —
// accepts the refresh token in the body (access token may already be expired).
router.post('/logout',         logoutHandler);
router.post('/delete-account',        authenticate, deleteAccount);
router.post('/resend-verification',   resendVerificationLimiter, resendVerification);
router.post('/forgot-password',       forgotPasswordLimiter, forgotPassword);
router.post('/reset-password',        resetPasswordLimiter,  resetPassword);

module.exports = router;

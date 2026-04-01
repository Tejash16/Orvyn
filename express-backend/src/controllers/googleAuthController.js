'use strict';

const googleAuthService = require('../services/googleAuthService');
const authService = require('../services/authService');
const logger = require('../services/logger');

/**
 * POST /api/v1/auth/google
 * Exchange Google auth code for app tokens.
 * Body: { code, redirectUri }
 */
async function googleLogin(req, res, next) {
  try {
    const { code, redirectUri, mode } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ success: false, error: 'code and redirectUri are required' });
    }

    // Validate mode — default to 'login' for backward compatibility
    const authMode = mode === 'signup' ? 'signup' : 'login';

    // Exchange code for Google profile
    const profile = await googleAuthService.exchangeCodeForProfile(code, redirectUri);

    if (!profile.emailVerified) {
      return res.status(400).json({ success: false, error: 'Google email is not verified' });
    }

    // Find or create user
    const result = await googleAuthService.findOrCreateGoogleUser(profile, authMode);

    if (result.noAccount) {
      return res.status(404).json({
        success: false,
        noAccount: true,
        error: 'No account found with this Google email. Please create an account first.',
      });
    }

    if (result.alreadyExists) {
      return res.status(409).json({
        success: false,
        alreadyExists: true,
        error: 'An account with this email already exists. Please sign in instead.',
      });
    }

    if (result.requiresLinking) {
      // Frontend needs to show password verification dialog
      return res.status(200).json({
        success: true,
        requiresLinking: true,
        email: result.email,
        googleId: profile.googleId,
        picture: profile.picture,
      });
    }

    const user = result.user;

    // Issue app tokens (same as local login)
    const accessToken = authService.issueAccessToken(user._id);
    const refreshToken = authService.issueRefreshToken(user._id);

    // Store hashed refresh token
    user.refreshToken = authService.hashToken(refreshToken);
    user.refreshTokenExpires = new Date(Date.now() + authService.REFRESH_TOKEN_TTL_MS);
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    logger.info(`Google login successful for user ${user.email}`);

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: user.toJSON(),
      isNewUser: result.isNewUser,
    });
  } catch (error) {
    logger.error('Google login error:', error);
    next(error);
  }
}

/**
 * POST /api/v1/auth/google/link
 * Link Google identity to existing local account.
 * Body: { email, password, googleId, picture }
 */
async function linkGoogle(req, res, next) {
  try {
    const { email, password, googleId, picture } = req.body;

    if (!email || !password || !googleId) {
      return res.status(400).json({ success: false, error: 'email, password, and googleId are required' });
    }

    const { user } = await googleAuthService.linkGoogleToLocalAccount(
      email, password, { googleId, picture }
    );

    // Issue tokens after successful linking
    const accessToken = authService.issueAccessToken(user._id);
    const refreshToken = authService.issueRefreshToken(user._id);

    user.refreshToken = authService.hashToken(refreshToken);
    user.refreshTokenExpires = new Date(Date.now() + authService.REFRESH_TOKEN_TTL_MS);
    await user.save();

    logger.info(`Google account linked for user ${user.email}`);

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: user.toJSON(),
      isNewUser: false,
    });
  } catch (error) {
    if (error.message === 'Invalid password') {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }
    if (error.message === 'User not found') {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    logger.error('Google link error:', error);
    next(error);
  }
}

module.exports = { googleLogin, linkGoogle };

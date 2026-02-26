const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');

// ── Constants ─────────────────────────────────────────────

const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────

function hashToken(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

function issueAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function issueRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

// ── Register ──────────────────────────────────────────────

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashed,
      provider: 'local',
      isEmailVerified: false,
    });

    const plainToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = hashToken(plainToken);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    console.log(`[Auth] Email verification token for ${user.email}: ${plainToken}`);

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }
    next(err);
  }
}

// ── Verify Email ──────────────────────────────────────────

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Verification token is required.' });
    }

    const hashed = hashToken(token);

    const user = await User.findOne({
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification token.' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    next(err);
  }
}

// ── Login ─────────────────────────────────────────────────

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    if (user.isDeleted) {
      return res.status(403).json({ success: false, error: 'Account deleted.' });
    }

    if (user.provider !== 'local') {
      return res.status(401).json({ success: false, error: 'This account uses a different sign-in method.' });
    }

    // ── Account lock check ─────────────────────────────────
    const nowMs = Date.now();
    if (user.lockUntil) {
      if (user.lockUntil > nowMs) {
        return res.status(423).json({ success: false, error: 'Account is temporarily locked. Try again later.' });
      }
      // Lock has expired — reset counter and continue
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(nowMs + 15 * 60 * 1000);
      }
      await user.save();
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ success: false, error: 'Email not verified.' });
    }

    // Successful auth — reset lock counters
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    const accessToken  = issueAccessToken(user._id);
    const refreshToken = issueRefreshToken(user._id);

    user.refreshToken        = hashToken(refreshToken);
    user.refreshTokenExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await user.save();

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (err) {
    next(err);
  }
}

// ── Refresh Token ─────────────────────────────────────────

async function refreshTokens(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token.' });
    }

    const hashed = hashToken(refreshToken);
    const user = await User.findOne({
      _id: decoded.userId,
      refreshToken: hashed,
      refreshTokenExpires: { $gt: Date.now() },
      isDeleted: { $ne: true },
    }).select('+refreshToken +refreshTokenExpires');

    if (!user) {
      return res.status(401).json({ success: false, error: 'Refresh token not recognised or already used.' });
    }

    const newAccessToken  = issueAccessToken(user._id);
    const newRefreshToken = issueRefreshToken(user._id);

    user.refreshToken        = hashToken(newRefreshToken);
    user.refreshTokenExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await user.save();

    return res.status(200).json({
      success: true,
      accessToken:  newAccessToken,
      refreshToken: newRefreshToken,
      user: user.toJSON(),
    });
  } catch (err) {
    next(err);
  }
}

// ── Get Current User ──────────────────────────────────────

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }
    if (user.isDeleted) {
      return res.status(403).json({ success: false, error: 'Account deleted.' });
    }
    return res.status(200).json({ success: true, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

// ── Logout (server-side token revocation) ─────────────────

async function logoutHandler(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const hashed  = hashToken(refreshToken);
        await User.findOneAndUpdate(
          { _id: decoded.userId, refreshToken: hashed },
          { $unset: { refreshToken: '', refreshTokenExpires: '' } }
        );
      } catch {
        // Token already invalid — no action needed
      }
    }

    return res.status(200).json({ success: true, message: 'Logged out.' });
  } catch (err) {
    next(err);
  }
}

// ── Delete Account ────────────────────────────────────────

async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required.' });
    }

    const user = await User.findById(req.user.userId).select('+password');
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(403).json({ success: false, error: 'Incorrect password.' });
    }

    user.isDeleted            = true;
    user.deletedAt            = new Date();
    user.refreshToken         = undefined;
    user.refreshTokenExpires  = undefined;
    await user.save();

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ── Forgot Password ───────────────────────────────────────

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const GENERIC = { success: true, message: 'If that email is registered, a reset link has been sent.' };

    if (!email || !validator.isEmail(email)) {
      return res.status(200).json(GENERIC);
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (user && !user.isDeleted) {
      const plainToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken   = hashToken(plainToken);
      user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      console.log(`[Auth] Password reset token for ${user.email}: ${plainToken}`);
    }

    return res.status(200).json(GENERIC);
  } catch (err) {
    next(err);
  }
}

// ── Reset Password ────────────────────────────────────────

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Token and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }

    const hashed = hashToken(token);
    const user = await User.findOne({
      passwordResetToken:   hashed,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user || user.isDeleted) {
      return res.status(400).json({ success: false, error: 'Reset link is invalid or has expired.' });
    }

    user.password             = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken         = undefined;
    user.refreshTokenExpires  = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    next(err);
  }
}

// ── Resend Verification ───────────────────────────────────

async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(200).json({ success: true, message: 'If that email is registered and unverified, a new link has been sent.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+emailVerificationToken +emailVerificationExpires');

    if (user && !user.isEmailVerified && !user.isDeleted) {
      const plainToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken   = hashToken(plainToken);
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();
      console.log(`[Auth] Resend verification token for ${user.email}: ${plainToken}`);
    }

    return res.status(200).json({ success: true, message: 'If that email is registered and unverified, a new link has been sent.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, verifyEmail, login, getMe, refreshTokens, logoutHandler, deleteAccount, resendVerification, forgotPassword, resetPassword };

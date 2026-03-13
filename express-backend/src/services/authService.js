'use strict';

const crypto      = require('crypto');
const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const validator   = require('validator');
const nodemailer  = require('nodemailer');

const User        = require('../models/User');
const codeService = require('./codeService');
const logger      = require('./logger');

// ── Token constants ────────────────────────────────────────

const ACCESS_TOKEN_TTL     = '15m';
const REFRESH_TOKEN_TTL    = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Token helpers (exported for controller use) ────────────

function hashToken(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

function issueAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function issueRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

// ── Mailer ─────────────────────────────────────────────────

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host   = process.env.SMTP_HOST;
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;
  const port   = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) return null; // dev fallback

  _transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return _transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    // Dev fallback — log to file only, never expose credentials
    logger.info(`[DEV EMAIL] To: ${to} | Subject: ${subject} | ${text}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

// ── Email templates ────────────────────────────────────────

async function sendVerificationEmail(email, code) {
  await sendEmail({
    to:      email,
    subject: 'Verify your Orvyn email',
    text:    `Your Orvyn verification code is: ${code}\n\nIt expires in ${codeService.CODE_EXPIRY_MINUTES} minutes.`,
    html:    `<p>Your Orvyn verification code is: <strong>${code}</strong></p><p>It expires in ${codeService.CODE_EXPIRY_MINUTES} minutes.</p>`,
  });
}

async function sendPasswordResetEmail(email, code) {
  await sendEmail({
    to:      email,
    subject: 'Reset your Orvyn password',
    text:    `Your Orvyn password reset code is: ${code}\n\nIt expires in ${codeService.CODE_EXPIRY_MINUTES} minutes.\n\nIf you did not request this, ignore this email.`,
    html:    `<p>Your Orvyn password reset code is: <strong>${code}</strong></p><p>It expires in ${codeService.CODE_EXPIRY_MINUTES} minutes.</p><p>If you did not request this, ignore this email.</p>`,
  });
}

// ── Mongoose select strings ────────────────────────────────

const VERIFICATION_SELECT =
  '+emailVerificationCodeHash +emailVerificationIssuedAt +emailVerificationExpires ' +
  '+emailVerificationAttempts +emailVerificationLockedUntil ' +
  '+emailVerificationResendAvailableAt +emailVerificationResendCount +emailVerificationResendWindowStart';

const RESET_SELECT =
  '+passwordResetCodeHash +passwordResetIssuedAt +passwordResetExpires ' +
  '+passwordResetAttempts +passwordResetLockedUntil ' +
  '+passwordResetResendAvailableAt +passwordResetResendCount +passwordResetResendWindowStart';

// ── Service methods ────────────────────────────────────────

/**
 * Register a new user. Issues a verification code and sends it by email.
 * @returns {{ cooldownSeconds: number }}
 */
async function registerUser({ name, email, password }) {
  if (!name || !email || !password) {
    const err = new Error('Name, email, and password are required.');
    err.statusCode = 400;
    throw err;
  }

  if (!validator.isEmail(email)) {
    const err = new Error('Invalid email address.');
    err.statusCode = 400;
    throw err;
  }

  if (password.length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.statusCode = 400;
    throw err;
  }

  const hashed = await bcrypt.hash(password, 12);

  let user;
  try {
    user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashed,
      provider: 'local',
      isEmailVerified: false,
    });
  } catch (err) {
    if (err.code === 11000) {
      const conflict = new Error('An account with this email already exists.');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw err;
  }

  const { code, cooldownSeconds } = codeService.issueCodeFresh(user, 'verification');
  await user.save();

  await sendVerificationEmail(user.email, code);

  return { cooldownSeconds };
}

/**
 * Authenticate a user. Returns access token, refresh token, and user object.
 * @returns {{ accessToken: string, refreshToken: string, user: object }}
 */
async function loginUser(email, password) {
  if (!email || !password) {
    const err = new Error('Email and password are required.');
    err.statusCode = 400;
    throw err;
  }

  if (!validator.isEmail(email)) {
    const err = new Error('Invalid email address.');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    const err = new Error('Invalid credentials.');
    err.statusCode = 401;
    throw err;
  }

  if (user.isDeleted) {
    const err = new Error('Account deleted.');
    err.statusCode = 403;
    throw err;
  }

  if (user.provider !== 'local') {
    const err = new Error('This account uses a different sign-in method.');
    err.statusCode = 401;
    throw err;
  }

  const nowMs = Date.now();

  // Account lock check
  if (user.lockUntil && user.lockUntil.getTime() > nowMs) {
    const err = new Error('Account is temporarily locked. Try again later.');
    err.statusCode = 423;
    throw err;
  }
  if (user.lockUntil && user.lockUntil.getTime() <= nowMs) {
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
    const err = new Error('Invalid credentials.');
    err.statusCode = 401;
    throw err;
  }

  if (!user.isEmailVerified) {
    const err = new Error('Email not verified.');
    err.statusCode = 403;
    throw err;
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;

  const accessToken  = issueAccessToken(user._id);
  const refreshToken = issueRefreshToken(user._id);

  user.refreshToken        = hashToken(refreshToken);
  user.refreshTokenExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await user.save();

  return { accessToken, refreshToken, user: user.toJSON() };
}

/**
 * Verify email address with a 6-digit code.
 */
async function verifyEmail(email, code) {
  if (!email || !code) {
    const err = new Error('Email and verification code are required.');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email: email.toLowerCase() })
    .select(VERIFICATION_SELECT);

  if (!user) {
    const err = new Error('No pending verification for this email.');
    err.statusCode = 400;
    throw err;
  }

  if (user.isEmailVerified) {
    const err = new Error('Email is already verified.');
    err.statusCode = 400;
    throw err;
  }

  const result = codeService.verifyCode(user, 'verification', code);

  if (!result.valid) {
    await user.save({ validateModifiedOnly: true });
    if (result.locked) {
      const msg = result.justLocked
        ? `Too many incorrect attempts. Try again in ${codeService.CODE_LOCK_MINUTES} minutes.`
        : `Too many incorrect attempts. Try again in ${Math.ceil(result.retryAfterSeconds / 60)} minutes.`;
      const err = new Error(msg);
      err.statusCode = 429;
      err.retryAfterSeconds = result.retryAfterSeconds;
      throw err;
    }
    if (result.expired) {
      const err = new Error('Verification code has expired. Please request a new one.');
      err.statusCode = 400;
      throw err;
    }
    if (result.noCode) {
      const err = new Error('No pending verification for this email.');
      err.statusCode = 400;
      throw err;
    }
    const remaining = result.attemptsLeft;
    const err = new Error(`Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    err.statusCode = 400;
    err.attemptsLeft = remaining;
    throw err;
  }

  user.isEmailVerified = true;
  codeService.invalidateCode(user, 'verification');
  await user.save({ validateModifiedOnly: true });
}

/**
 * Request a password reset. Issues a 6-digit code and emails it.
 * Always returns a generic message — never reveals whether an email exists.
 * @returns {{ cooldownSeconds: number }}
 */
async function requestPasswordReset(email) {
  const user = await User.findOne({ email: email.toLowerCase() })
    .select(RESET_SELECT);

  if (!user || user.isDeleted) {
    return { cooldownSeconds: codeService.CODE_RESEND_COOLDOWN_SECONDS };
  }

  const { code, cooldownSeconds } = codeService.issueCodeFresh(user, 'reset');
  await user.save({ validateModifiedOnly: true });

  await sendPasswordResetEmail(user.email, code);

  return { cooldownSeconds };
}

/**
 * Validate a password reset code (does NOT update the password).
 * Call this before showing the new-password form.
 */
async function verifyResetCode(email, code) {
  if (!email || !code) {
    const err = new Error('Email and reset code are required.');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email: email.toLowerCase() })
    .select(RESET_SELECT);

  if (!user || user.isDeleted) {
    const err = new Error('Invalid or expired reset code.');
    err.statusCode = 400;
    throw err;
  }

  const result = codeService.verifyCode(user, 'reset', code);

  if (!result.valid) {
    await user.save({ validateModifiedOnly: true });
    if (result.locked) {
      const msg = result.justLocked
        ? `Too many incorrect attempts. Try again in ${codeService.CODE_LOCK_MINUTES} minutes.`
        : `Too many incorrect attempts. Try again in ${Math.ceil(result.retryAfterSeconds / 60)} minutes.`;
      const err = new Error(msg);
      err.statusCode = 429;
      err.retryAfterSeconds = result.retryAfterSeconds;
      throw err;
    }
    if (result.expired) {
      const err = new Error('Reset code has expired. Please request a new one.');
      err.statusCode = 400;
      throw err;
    }
    if (result.noCode) {
      const err = new Error('Invalid or expired reset code.');
      err.statusCode = 400;
      throw err;
    }
    const remaining = result.attemptsLeft;
    const err = new Error(`Invalid reset code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    err.statusCode = 400;
    err.attemptsLeft = remaining;
    throw err;
  }

  // Do NOT invalidate — code must remain valid for the resetPassword step
  await user.save({ validateModifiedOnly: true });
}

/**
 * Reset password using email + code + new password.
 * Validates the code, updates the password, revokes all refresh tokens.
 */
async function resetPassword(email, code, newPassword) {
  if (!email || !code || !newPassword) {
    const err = new Error('Email, code, and new password are required.');
    err.statusCode = 400;
    throw err;
  }

  if (newPassword.length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password ' + RESET_SELECT);

  if (!user || user.isDeleted) {
    const err = new Error('Invalid or expired reset code.');
    err.statusCode = 400;
    throw err;
  }

  const result = codeService.verifyCode(user, 'reset', code);

  if (!result.valid) {
    await user.save();
    if (result.locked) {
      const err = new Error('Too many incorrect attempts. Please request a new reset code.');
      err.statusCode = 429;
      err.retryAfterSeconds = result.retryAfterSeconds;
      throw err;
    }
    if (result.expired) {
      const err = new Error('Reset code has expired. Please request a new one.');
      err.statusCode = 400;
      throw err;
    }
    const err = new Error('Invalid or expired reset code.');
    err.statusCode = 400;
    throw err;
  }

  user.password            = await bcrypt.hash(newPassword, 12);
  user.refreshToken        = undefined;
  user.refreshTokenExpires = undefined;
  codeService.invalidateCode(user, 'reset');
  await user.save();
}

/**
 * Resend email verification code with cooldown and hourly cap enforcement.
 * @returns {{ cooldownSeconds?: number, retryAfterSeconds?: number }}
 */
async function resendVerificationCode(email) {
  const user = await User.findOne({ email: email.toLowerCase() })
    .select(VERIFICATION_SELECT);

  if (!user || user.isEmailVerified || user.isDeleted) {
    return { cooldownSeconds: codeService.CODE_RESEND_COOLDOWN_SECONDS };
  }

  const check = codeService.checkResend(user, 'verification');
  if (!check.allowed) {
    return { retryAfterSeconds: check.retryAfterSeconds };
  }

  const { code, cooldownSeconds } = codeService.issueReplacementCode(user, 'verification');
  await user.save({ validateModifiedOnly: true });

  await sendVerificationEmail(user.email, code);

  return { cooldownSeconds };
}

/**
 * Resend password reset code with cooldown and hourly cap enforcement.
 * @returns {{ cooldownSeconds?: number, retryAfterSeconds?: number }}
 */
async function resendResetCode(email) {
  const user = await User.findOne({ email: email.toLowerCase() })
    .select(RESET_SELECT);

  if (!user || user.isDeleted) {
    return { cooldownSeconds: codeService.CODE_RESEND_COOLDOWN_SECONDS };
  }

  const check = codeService.checkResend(user, 'reset');
  if (!check.allowed) {
    return { retryAfterSeconds: check.retryAfterSeconds };
  }

  const { code, cooldownSeconds } = codeService.issueReplacementCode(user, 'reset');
  await user.save({ validateModifiedOnly: true });

  await sendPasswordResetEmail(user.email, code);

  return { cooldownSeconds };
}

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
  resendVerificationCode,
  resendResetCode,
  // Token helpers used by authController for flows not delegated to this service
  hashToken,
  issueAccessToken,
  issueRefreshToken,
  REFRESH_TOKEN_TTL_MS,
};

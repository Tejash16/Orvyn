'use strict';

const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const oauthClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

/**
 * Exchange authorization code for tokens, then verify the id_token.
 * @param {string} code - Authorization code from Google
 * @param {string} redirectUri - The redirect URI used in the auth request
 * @returns {Object} { email, name, picture, googleId, emailVerified }
 */
async function exchangeCodeForProfile(code, redirectUri) {
  const { tokens } = await oauthClient.getToken({
    code,
    redirect_uri: redirectUri,
  });

  // Verify the id_token
  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    emailVerified: payload.email_verified,
  };
}

/**
 * Find existing user or create new one from Google profile.
 * Handles account linking when email already exists with local provider.
 *
 * @param {Object} profile - { googleId, email, name, picture, emailVerified }
 * @param {'login'|'signup'} mode - 'login' only signs in existing users; 'signup' only creates new users
 * @returns {Object} { user, isNewUser, requiresLinking, noAccount?, alreadyExists?, email? }
 */
async function findOrCreateGoogleUser(profile, mode) {
  // 1. Check if user exists by googleId (returning Google user)
  let user = await User.findOne({ googleId: profile.googleId, isDeleted: false });
  if (user) {
    if (mode === 'signup') {
      return { user: null, isNewUser: false, requiresLinking: false, alreadyExists: true };
    }
    return { user, isNewUser: false, requiresLinking: false };
  }

  // 2. Check if email exists with a local provider (account linking case)
  user = await User.findOne({ email: profile.email.toLowerCase(), isDeleted: false });
  if (user) {
    if (user.provider === 'local') {
      // Account linking required — return flag, don't auto-link
      return { user: null, isNewUser: false, requiresLinking: true, email: profile.email };
    }
    // Already linked or is google-only — update googleId if missing
    if (mode === 'signup') {
      return { user: null, isNewUser: false, requiresLinking: false, alreadyExists: true };
    }
    if (!user.googleId) {
      user.googleId = profile.googleId;
      user.profilePicture = profile.picture;
      await user.save();
    }
    return { user, isNewUser: false, requiresLinking: false };
  }

  // 2.5. Check for soft-deleted user (deleted account re-registration)
  const deletedUser = await User.findOne({
    email: profile.email.toLowerCase(),
    isDeleted: true,
  });

  if (deletedUser) {
    if (mode === 'login') {
      return { user: null, isNewUser: false, requiresLinking: false, noAccount: true };
    }

    // Signup mode — reactivate the soft-deleted account
    deletedUser.isDeleted = false;
    deletedUser.deletedAt = undefined;
    deletedUser.name = profile.name;
    deletedUser.googleId = profile.googleId;
    deletedUser.profilePicture = profile.picture;
    deletedUser.provider = 'google';
    deletedUser.isEmailVerified = true;
    deletedUser.password = undefined;
    deletedUser.refreshToken = undefined;
    deletedUser.refreshTokenExpires = undefined;
    deletedUser.failedLoginAttempts = 0;
    deletedUser.lockUntil = undefined;
    await deletedUser.save();

    return { user: deletedUser, isNewUser: true, requiresLinking: false };
  }

  // 3. New user
  if (mode === 'login') {
    // Login mode — don't auto-create, tell user to register first
    return { user: null, isNewUser: false, requiresLinking: false, noAccount: true };
  }

  // Signup mode — create account
  const newUser = await User.create({
    name: profile.name,
    email: profile.email.toLowerCase(),
    googleId: profile.googleId,
    profilePicture: profile.picture,
    provider: 'google',
    isEmailVerified: true, // Google already verified the email
    userType: 'individual', // Default, user selects type after first login
  });

  return { user: newUser, isNewUser: true, requiresLinking: false };
}

/**
 * Link Google identity to an existing local account after password verification.
 * @param {string} email
 * @param {string} password - User's existing password for verification
 * @param {Object} googleProfile - { googleId, picture }
 * @returns {Object} { user }
 */
async function linkGoogleToLocalAccount(email, password, googleProfile) {
  const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false }).select('+password');
  if (!user) {
    throw new Error('User not found');
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Invalid password');
  }

  // Link the Google identity
  user.googleId = googleProfile.googleId;
  user.profilePicture = googleProfile.picture;
  user.provider = 'local+google'; // Supports both login methods
  await user.save();

  return { user };
}

module.exports = {
  exchangeCodeForProfile,
  findOrCreateGoogleUser,
  linkGoogleToLocalAccount,
};

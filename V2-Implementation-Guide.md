# Orvyn V2 Implementation Guide

## Architecture Decisions & Answers

### How Big Companies Handle Google Auth With Their Own Database

Google OAuth is purely an **identity provider**. Your Express backend maintains full user records. This is exactly how Notion, Figma, Slack, Linear, and every major SaaS handles it:

1. User clicks "Sign in with Google" -> Google verifies identity -> returns an `id_token` containing email, name, picture, and a Google user ID (`sub`)
2. Your Express backend verifies the `id_token` -> checks "does a user with this `googleId` exist in MY MongoDB?"
   - **YES** -> Issue YOUR OWN JWT tokens (same as local login)
   - **NO** -> Create a new User record with `provider: 'google'`, `googleId`, `email`, `name` -> Issue YOUR tokens
3. From that point on, the user is authenticated with YOUR tokens, not Google's
4. Google stores nothing about your app. Your MongoDB has the full user profile

**The key insight**: Google Auth replaces the "email + password + OTP verification" step. Everything else (your JWT system, token vault, refresh scheduler, user context) stays exactly the same. Google just proves "this person owns this email" -- your app handles everything after that.

### Collaboration: Cloud Storage vs Data Transfer

**Share the intelligence, NOT the files. No cloud file storage needed.**

Files are LOCAL PATH references (`C:\Users\tejus\Documents\file.pdf`). These paths don't exist on other machines. Uploading files to cloud would be expensive, violate the privacy-first desktop-app promise, and require massive architecture changes.

Instead, share a **DataRoom snapshot** via Express (MongoDB) containing:
- Folder tree structure + context descriptions
- File metadata (name, extension, size -- NOT original_path)
- **Full extracted text** from `file_chunks` table (for indexed files) or `extracted_text` column (for unindexed files, limited to 3000 chars)
- AI classifications (folder assignment, confidence, reasoning)
- AI summaries + entities

**Important**: The `files.extracted_text` column only stores the first **3000 characters** (truncated at registration). However, the `file_chunks` table stores the **complete extracted text** in chunks (created during indexing). The export endpoint must pull full text from `file_chunks` when available, falling back to the truncated `extracted_text` for unindexed files.

What is NOT shared: actual files, file paths, ChromaDB embeddings. If the recipient wants Copilot on the shared DataRoom, embeddings are re-generated locally from the shared full text.

### Cross-Organization Sharing

All user types can share with each other:
- Individual <-> Individual: Share freely
- Enterprise <-> Enterprise (same org): Share freely, can see all org members
- Enterprise <-> Individual: Allowed by default
- Enterprise <-> Enterprise (different org): Allowed by default

Org admins can restrict external sharing via an org-level setting (`allowExternalSharing`, default: `true`).

---

## How to Use This Guide

Each phase should be implemented **in order** — later phases depend on earlier ones. Use the prompts below to start each phase in a new Claude session. Copy-paste the prompt as-is.

After all 6 phases are implemented, use the **Phase 7 prompt** to update the CLAUDE documentation files.

---

### Phase 1 Prompt — Google OAuth

```
Read CLAUDE.md, CLAUDE-EXPRESS.md, CLAUDE-ELECTRON.md, and CLAUDE-FRONTEND.md. Then read the "Phase 1: Google OAuth" section (Sections 1.1–1.13) in V2-Implementation-Guide.md. Implement Phase 1 fully — this covers Express backend (Google auth service, controller, routes, edge case guards, User model updates), Electron (loopback OAuth server, IPC handlers, preload), and Frontend (Google sign-in button, account linking dialog, auth slice updates). This phase has no dependencies on other phases. Follow all architecture rules from CLAUDE.md — especially the React → Electron IPC → Express/Python flow. Do not install packages without asking me first.
```

### Phase 2 Prompt — User Types + Limits

```
Read CLAUDE.md, CLAUDE-EXPRESS.md, CLAUDE-ELECTRON.md, and CLAUDE-FRONTEND.md. Then read the "Phase 2: User Types + Limits" section (Sections 2.1–2.9) in V2-Implementation-Guide.md. Implement Phase 2 fully — this covers the user type selection screen (Frontend), set-user-type endpoint (Express), UserLimits model updates, plan-to-limits mapping, limits check endpoint, DataRoom limit enforcement (Electron), subscription state in Redux, and server-side usage enforcement middleware (enforceLimits). This phase depends on Phase 1 (userType field on User model). Follow all architecture rules from CLAUDE.md. Do not install packages without asking me first.
```

### Phase 3 Prompt — Organization Model

```
Read CLAUDE.md, CLAUDE-EXPRESS.md, CLAUDE-ELECTRON.md, and CLAUDE-FRONTEND.md. Then read the "Phase 3: Organization Model" section (Sections 3.1–3.7) in V2-Implementation-Guide.md. Implement Phase 3 fully — this covers MongoDB models (Organization, OrganizationMember, OrganizationInvite), orgAuthorize middleware, organization CRUD + member + invite endpoints (Express), organization IPC handlers (Electron), preload bridge, deep link protocol for invite emails, organizationSlice (Frontend), email service for invites, and new pages (OrganizationSettings, CreateOrganization, JoinOrganization). This phase depends on Phase 2 (user types). Follow all architecture rules from CLAUDE.md. Do not install packages without asking me first.
```

### Phase 4 Prompt — Razorpay Integration

```
Read CLAUDE.md, CLAUDE-EXPRESS.md, CLAUDE-ELECTRON.md, and CLAUDE-FRONTEND.md. Then read the "Phase 4: Razorpay Integration" section (Sections 4.1–4.10) in V2-Implementation-Guide.md. Implement Phase 4 fully — this covers Razorpay setup, Express web page serving for checkout (EJS views), Subscription model, razorpayService (create subscription, webhook handling, payment emails, refunds), billing routes, billing IPC handlers (Electron), preload bridge, periodic subscription check, billingSlice and BillingSettings component (Frontend). This phase depends on Phase 2 (limits) and can be built in parallel with Phase 3. Follow all architecture rules from CLAUDE.md. Do not install packages without asking me first.
```

### Phase 5 Prompt — Collaboration / DataRoom Sharing

```
Read CLAUDE.md, CLAUDE-EXPRESS.md, CLAUDE-ELECTRON.md, CLAUDE-PYTHON.md, and CLAUDE-FRONTEND.md. Then read the "Phase 5: Collaboration / DataRoom Sharing" section (Sections 5.1–5.11) in V2-Implementation-Guide.md. Implement Phase 5 fully — this covers MongoDB models (SharedDataRoom, SharedDataRoomAccess), sharing routes + controller (Express), Python export/import endpoints with full-text chunk reconstruction, SQLite schema changes (is_shared columns + migration), sharing IPC handlers (Electron), preload bridge, sharingSlice (Frontend), CollaborationPage with sidebar nav item, ShareDialog, SharedWithMe, MyShares components, and shared DataRoom UI behavior. This phase depends on Phase 2 (user types) and involves ALL 4 layers. Follow all architecture rules from CLAUDE.md. Do not install packages without asking me first.
```

### Phase 6 Prompt — Audit Logs (Enterprise)

```
Read CLAUDE.md, CLAUDE-EXPRESS.md, CLAUDE-ELECTRON.md, and CLAUDE-FRONTEND.md. Then read the "Phase 6: Audit Logs (Enterprise)" section (Sections 6.1–6.6) in V2-Implementation-Guide.md. Implement Phase 6 fully — this covers the AuditLog MongoDB model, auditService utility, adding logAudit() calls to all sharing/org/billing controllers per the mapping table, audit log query endpoints (org-level and user-level), organization IPC handler for audit logs, and the Activity Log tab in OrganizationSettings (Frontend). This phase depends on Phase 3 (organizations) and should be implemented after Phase 5 (collaboration). Follow all architecture rules from CLAUDE.md. Do not install packages without asking me first.
```

### Phase 7 Prompt — Update Documentation After V2

```
Read the current CLAUDE.md, CLAUDE-EXPRESS.md, CLAUDE-ELECTRON.md, CLAUDE-PYTHON.md, and CLAUDE-FRONTEND.md files. Then read the "Summary: All New Files" section at the end of V2-Implementation-Guide.md. Cross-reference every new file, modified file, new endpoint, new IPC channel, new Redux slice, new MongoDB model, new environment variable, and new dependency that was added during V2 implementation against the CLAUDE documentation files. Update each CLAUDE file to accurately reflect the current codebase after V2:

- CLAUDE.md: Update folder structure (Section 2) to include new files/directories. Update Section 3 responsibilities if needed. Add any new cross-cutting rules.
- CLAUDE-EXPRESS.md: Add all new Express endpoints (Google auth, organization, billing, sharing, audit), new MongoDB models (Organization, OrganizationMember, OrganizationInvite, Subscription, SharedDataRoom, SharedDataRoomAccess, AuditLog), new middleware (orgAuthorize, enforceLimits), new services (googleAuthService, razorpayService, emailService, auditService), new rate limiters, and new environment variables.
- CLAUDE-ELECTRON.md: Add all new IPC channels (auth:initiateGoogleAuth, auth:linkGoogleAccount, org:*, billing:*, sharing:*), new handler files, new preload namespaces, deep link protocol, and new push events.
- CLAUDE-PYTHON.md: Add new sharing endpoints (export-dataroom, import-dataroom), new SQLite columns (is_shared on datarooms and files), and migration logic.
- CLAUDE-FRONTEND.md: Add new Redux slices (organizationSlice, billingSlice, sharingSlice), new components, new pages (CollaborationPage, OrganizationSettings), updated authSlice state, and updated sidebar navigation.

Verify by reading the actual source files — do not just copy from V2-Implementation-Guide.md. The guide is a plan; the code is the truth. Fix any discrepancies between the guide and the actual implementation.
```

---

## Phase 1: Google OAuth

**Goal**: Add "Sign in with Google" alongside existing email/password auth.

**Dependencies**: None -- this phase is independent.

### 1.1 Google Cloud Console Setup (Step-by-Step)

**Prerequisites**: A Google account. No payment needed — OAuth is free.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **Create Project**:
   - Click the project dropdown (top-left, next to "Google Cloud") → "New Project"
   - Name: `Orvyn` (or `Orvyn Desktop`)
   - Organization: leave as "No organization" if you don't have one
   - Click "Create" → wait 10 seconds → select the new project from the dropdown
3. **Configure OAuth Consent Screen** (MUST do this before creating credentials):
   - Left sidebar → "APIs & Services" → "OAuth consent screen"
   - User type: **External** (allows any Google account to sign in)
   - Click "Create"
   - Fill in the form:
     - App name: `Orvyn`
     - User support email: your email
     - Developer contact email: your email
   - Click "Save and Continue"
   - **Scopes**: Click "Add or Remove Scopes" → select:
     - `openid`
     - `email`
     - `profile`
   - Click "Save and Continue"
   - **Test users**: Add your own Google email for testing
   - Click "Save and Continue" → "Back to Dashboard"
4. **Create OAuth Credentials**:
   - Left sidebar → "APIs & Services" → "Credentials"
   - Click "+ Create Credentials" → "OAuth client ID"
   - Application type: **Desktop app** (NOT "Web application")
   - Name: `Orvyn Desktop`
   - Click "Create"
   - A dialog shows your **Client ID** and **Client Secret** — **copy both now**
   - (You can also download the JSON file for reference)
5. **Important note**: Google's desktop app OAuth uses the **loopback redirect** pattern (`http://127.0.0.1:{port}`) — custom protocol URIs like `orvyn://` are NOT supported for desktop client types. The Electron loopback server (Section 1.8) handles this.
6. **Add to environment variables**:
   - `express-backend/.env`:
     ```
     GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
     ```
   - `electron/.env` (Client ID only — needed for constructing the auth URL in Electron):
     ```
     GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
     ```
   - `express-backend/.env.example`:
     ```
     GOOGLE_CLIENT_ID=
     GOOGLE_CLIENT_SECRET=
     ```
   - `electron/.env.example`:
     ```
     GOOGLE_CLIENT_ID=
     ```
7. **Publishing status**: While in "Testing" mode, only test users you added can sign in. To allow all Google users:
   - Go to "OAuth consent screen" → "Publishing status" → Click "Publish App"
   - Google may require a verification review (takes a few days) if you request sensitive scopes
   - For `openid`, `email`, `profile` — these are non-sensitive, verification is usually instant

### 1.2 Express Backend: New Dependency

```bash
cd express-backend
npm install google-auth-library
```

### 1.3 Express Backend: Update User Model

**File**: `express-backend/src/models/User.js`

Add these fields to the `userSchema`:

```javascript
googleId: {
  type: String,
  sparse: true,
  unique: true,
  default: null,
},
profilePicture: {
  type: String,
  default: null,
},
userType: {
  type: String,
  enum: ['individual', 'enterprise'],
  default: 'individual',
},
activeOrganizationId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Organization',
  default: null,
},
```

Modify the `password` field to be conditionally required:
```javascript
password: {
  type: String,
  // Required only for local provider
  required: function() { return this.provider === 'local'; },
  select: false,
},
```

Update the `provider` field to support linked accounts:
```javascript
provider: {
  type: String,
  enum: ['local', 'google', 'local+google'],
  default: 'local',
},
```

### 1.4 Express Backend: Google Auth Service

**New file**: `express-backend/src/services/googleAuthService.js`

```javascript
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('./authService');

const oauthClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

/**
 * Exchange authorization code for tokens, then verify the id_token.
 * @param {string} code - Authorization code from Google
 * @param {string} redirectUri - The redirect URI used in the auth request
 * @returns {Object} { email, name, picture, googleId }
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
 * @returns {Object} { user, isNewUser, requiresLinking }
 */
async function findOrCreateGoogleUser(profile) {
  // 1. Check if user exists by googleId (returning Google user)
  let user = await User.findOne({ googleId: profile.googleId, isDeleted: false });
  if (user) {
    return { user, isNewUser: false, requiresLinking: false };
  }

  // 2. Check if email exists with a local provider (account linking case)
  user = await User.findOne({ email: profile.email.toLowerCase(), isDeleted: false });
  if (user) {
    if (user.provider === 'local') {
      // Account linking required -- return flag, don't auto-link
      return { user: null, isNewUser: false, requiresLinking: true, email: profile.email };
    }
    // Already linked or is google-only -- update googleId if missing
    if (!user.googleId) {
      user.googleId = profile.googleId;
      user.profilePicture = profile.picture;
      await user.save();
    }
    return { user, isNewUser: false, requiresLinking: false };
  }

  // 3. New user -- create account
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
  const bcrypt = require('bcryptjs');
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
```

### 1.5 Express Backend: Google Auth Controller

**New file**: `express-backend/src/controllers/googleAuthController.js`

```javascript
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
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'code and redirectUri are required' });
    }

    // Exchange code for Google profile
    const profile = await googleAuthService.exchangeCodeForProfile(code, redirectUri);

    if (!profile.emailVerified) {
      return res.status(400).json({ error: 'Google email is not verified' });
    }

    // Find or create user
    const result = await googleAuthService.findOrCreateGoogleUser(profile);

    if (result.requiresLinking) {
      // Frontend needs to show password verification dialog
      return res.status(200).json({
        requiresLinking: true,
        email: result.email,
        googleId: profile.googleId,
        picture: profile.picture,
      });
    }

    const user = result.user;

    // Issue app tokens (same as local login)
    const accessToken = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    // Store hashed refresh token
    const crypto = require('crypto');
    user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    logger.info(`Google login successful for user ${user.email}`);

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        provider: user.provider,
        profilePicture: user.profilePicture,
        userType: user.userType,
        activeOrganizationId: user.activeOrganizationId,
      },
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
      return res.status(400).json({ error: 'email, password, and googleId are required' });
    }

    const { user } = await googleAuthService.linkGoogleToLocalAccount(
      email, password, { googleId, picture }
    );

    // Issue tokens after successful linking
    const accessToken = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    const crypto = require('crypto');
    user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        provider: user.provider,
        profilePicture: user.profilePicture,
        userType: user.userType,
      },
      isNewUser: false,
    });
  } catch (error) {
    if (error.message === 'Invalid password') {
      return res.status(401).json({ error: 'Invalid password' });
    }
    next(error);
  }
}

module.exports = { googleLogin, linkGoogle };
```

### 1.6 Express Backend: Update Auth Routes

**File**: `express-backend/src/routes/auth.js`

Add these routes:
```javascript
const { googleLogin, linkGoogle } = require('../controllers/googleAuthController');
const { googleLoginLimiter } = require('../middleware/rateLimiter');

router.post('/google', googleLoginLimiter, googleLogin);
router.post('/google/link', googleLoginLimiter, linkGoogle);
```

**File**: `express-backend/src/middleware/rateLimiter.js`

Add:
```javascript
const googleLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many Google login attempts, try again later' },
});

module.exports = { ...existing, googleLoginLimiter };
```

### 1.7 Express Backend: Edge Case Guards

**File**: `express-backend/src/services/authService.js`

In `registerUser()` -- block local registration if email is already a Google account:
```javascript
// After checking for existing user
const existingUser = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
if (existingUser) {
  if (existingUser.provider === 'google' || existingUser.provider === 'local+google') {
    throw new Error('This email is registered via Google. Please sign in with Google.');
  }
  throw new Error('Email already registered');
}
```

In `loginUser()` -- block email/password login for Google-only users:
```javascript
// After finding user by email, before password comparison
if (user.provider === 'google') {
  throw new Error('This account uses Google sign-in. Please click "Sign in with Google" instead.');
}
// Note: provider === 'local+google' should still allow password login (user has both methods)
```

**Frontend enforcement** (`frontend/src/components/auth/Login.jsx`):
```javascript
// In the login error handler, detect this specific error and show a clear UX:
if (error.includes('Google sign-in')) {
  // Show a specific message with a button/link that triggers Google auth
  setGoogleOnlyError(true); // State flag to render Google sign-in prompt instead of generic error
}

// In JSX, when googleOnlyError is true:
// <div className="google-only-notice">
//   <p>This account was created with Google. Please sign in with Google.</p>
//   <GoogleSignInButton onClick={handleGoogleAuth} />
// </div>
```

In `forgotPassword()` -- block password reset for Google-only users:
```javascript
if (user.provider === 'google') {
  // Return generic success to prevent email enumeration, but don't send code
  return { message: 'If this email exists, a reset code has been sent', cooldownSeconds: 60 };
}
```

### 1.8 Electron: Loopback OAuth Server

Since Google's desktop app OAuth requires loopback redirect, Electron needs a temporary localhost server.

**File**: `electron/services/authService.js`

Add these methods:

```javascript
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const { shell } = require('electron');
const log = require('./logger');

let _googleAuthServer = null;
let _googleAuthState = null;

/**
 * Start Google OAuth flow.
 * 1. Spin up temporary localhost server
 * 2. Open system browser with Google consent URL
 * 3. Wait for callback with authorization code
 * 4. Exchange code via Express
 */
function initiateGoogleAuth() {
  return new Promise((resolve, reject) => {
    // Generate CSRF state token
    _googleAuthState = crypto.randomBytes(32).toString('hex');

    // Create temporary server on random port
    _googleAuthServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1`);

        if (url.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        // Send success HTML response to browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h2>${error ? 'Authentication Failed' : 'Authentication Successful'}</h2>
              <p>${error ? 'You can close this window and try again.' : 'You can close this window and return to Orvyn.'}</p>
              <script>window.close();</script>
            </body>
          </html>
        `);

        // Clean up server
        _googleAuthServer.close();
        _googleAuthServer = null;

        if (error) {
          reject(new Error(`Google auth error: ${error}`));
          return;
        }

        // Verify CSRF state
        if (state !== _googleAuthState) {
          reject(new Error('Invalid state parameter -- possible CSRF attack'));
          return;
        }

        resolve({ code, redirectUri: `http://127.0.0.1:${_googleAuthServer.address().port}/callback` });
      } catch (err) {
        reject(err);
      }
    });

    // Listen on random port
    _googleAuthServer.listen(0, '127.0.0.1', () => {
      const port = _googleAuthServer.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;

      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
      googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
      googleAuthUrl.searchParams.set('response_type', 'code');
      googleAuthUrl.searchParams.set('scope', 'openid email profile');
      googleAuthUrl.searchParams.set('state', _googleAuthState);
      googleAuthUrl.searchParams.set('access_type', 'offline');

      // Open in system browser
      shell.openExternal(googleAuthUrl.toString());
      log.info(`Google OAuth server started on port ${port}`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (_googleAuthServer) {
        _googleAuthServer.close();
        _googleAuthServer = null;
        reject(new Error('Google auth timed out'));
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Complete Google login by sending code to Express.
 */
async function googleLogin(code, redirectUri) {
  const expressUrl = process.env.EXPRESS_URL;
  const response = await fetch(`${expressUrl}/api/v1/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Google login failed');
  }

  return data;
}

/**
 * Link Google to existing local account.
 */
async function linkGoogleAccount(email, password, googleId, picture) {
  const expressUrl = process.env.EXPRESS_URL;
  const response = await fetch(`${expressUrl}/api/v1/auth/google/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, googleId, picture }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Account linking failed');
  return data;
}
```

Add `GOOGLE_CLIENT_ID` to `electron/.env` and `electron/.env.example`:
```
GOOGLE_CLIENT_ID=your_client_id_here
```

Note: Only the `CLIENT_ID` goes in Electron (it's public). The `CLIENT_SECRET` stays in Express only.

### 1.9 Electron: IPC Handlers for Google Auth

**File**: `electron/ipc/authHandlers.js`

Add these handlers alongside existing ones:

```javascript
// Google OAuth: Initiate
ipcMain.handle('auth:initiateGoogleAuth', async () => {
  try {
    const { code, redirectUri } = await authService.initiateGoogleAuth();
    const result = await authService.googleLogin(code, redirectUri);

    if (result.requiresLinking) {
      // Notify renderer to show password dialog
      return { success: false, requiresLinking: true, email: result.email, googleId: result.googleId, picture: result.picture };
    }

    // Same login sequence as email login (steps 2-7)
    const user = result.user;
    await userContextService.initializeUserDirectory(user._id);
    const dbPath = userContextService.getDatabasePath();
    await pythonService.initDb(dbPath, user._id);

    let theme = 'light';
    try {
      const themeResult = await pythonService.getTheme();
      if (themeResult && themeResult.theme) theme = themeResult.theme;
    } catch (e) { /* use default */ }

    authService.setToken(result.accessToken);
    authService.setUser(user);
    tokenVault.store(result.refreshToken);
    tokenRefreshScheduler.schedule(result.accessToken);

    // Resume pending indexing if any
    try { await resumePendingIndexing(); } catch (e) { /* non-critical */ }

    return {
      success: true,
      user,
      theme,
      isNewUser: result.isNewUser,
    };
  } catch (error) {
    log.error('Google auth failed:', error);
    return { success: false, error: error.message };
  }
});

// Google OAuth: Link existing account
ipcMain.handle('auth:linkGoogleAccount', async (event, { email, password, googleId, picture }) => {
  try {
    const result = await authService.linkGoogleAccount(email, password, googleId, picture);

    // Same login sequence
    const user = result.user;
    await userContextService.initializeUserDirectory(user._id);
    const dbPath = userContextService.getDatabasePath();
    await pythonService.initDb(dbPath, user._id);

    let theme = 'light';
    try {
      const themeResult = await pythonService.getTheme();
      if (themeResult && themeResult.theme) theme = themeResult.theme;
    } catch (e) { /* use default */ }

    authService.setToken(result.accessToken);
    authService.setUser(user);
    tokenVault.store(result.refreshToken);
    tokenRefreshScheduler.schedule(result.accessToken);

    return { success: true, user, theme };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### 1.10 Electron: Preload Bridge

**File**: `electron/preload.js`

Add to the `auth` namespace:
```javascript
auth: {
  // ... existing methods ...
  initiateGoogleAuth: () => ipcRenderer.invoke('auth:initiateGoogleAuth'),
  linkGoogleAccount: (payload) => ipcRenderer.invoke('auth:linkGoogleAccount', payload),
},
```

### 1.11 Frontend: Google Sign-In Button

**File**: `frontend/src/components/auth/Login.jsx`

Add below the existing login form:

```jsx
const [isGoogleLoading, setIsGoogleLoading] = useState(false);
const [linkingState, setLinkingState] = useState(null); // { email, googleId, picture }

const handleGoogleSignIn = async () => {
  setIsGoogleLoading(true);
  try {
    const result = await window.api.auth.initiateGoogleAuth();

    if (result.requiresLinking) {
      // Show password dialog for account linking
      setLinkingState({
        email: result.email,
        googleId: result.googleId,
        picture: result.picture,
      });
      setIsGoogleLoading(false);
      return;
    }

    if (result.success) {
      dispatch(loginSuccess(result.user));
      if (result.theme) dispatch(setTheme(result.theme));
      if (result.isNewUser) {
        // Navigate to user type selection
        setView('selectUserType');
      }
    } else {
      setError(result.error);
    }
  } catch (err) {
    setError('Google sign-in failed');
  }
  setIsGoogleLoading(false);
};

const handleLinkAccount = async (password) => {
  try {
    const result = await window.api.auth.linkGoogleAccount({
      email: linkingState.email,
      password,
      googleId: linkingState.googleId,
      picture: linkingState.picture,
    });
    if (result.success) {
      dispatch(loginSuccess(result.user));
      if (result.theme) dispatch(setTheme(result.theme));
      setLinkingState(null);
    } else {
      setError(result.error);
    }
  } catch (err) {
    setError('Account linking failed');
  }
};
```

```jsx
{/* Below existing form */}
<div className="auth-divider">
  <span>or</span>
</div>

<button
  className="google-signin-btn"
  onClick={handleGoogleSignIn}
  disabled={isGoogleLoading}
>
  <svg className="google-icon" viewBox="0 0 24 24">
    {/* Google "G" logo SVG path */}
  </svg>
  {isGoogleLoading ? 'Signing in...' : 'Sign in with Google'}
</button>

{/* Account linking dialog */}
{linkingState && (
  <AccountLinkDialog
    email={linkingState.email}
    onSubmit={handleLinkAccount}
    onCancel={() => setLinkingState(null)}
  />
)}
```

### 1.12 Frontend: Update Auth Slice

**File**: `frontend/src/store/authSlice.js`

Update the user shape to include new fields:
```javascript
// The user object now includes:
// { _id, name, email, provider, profilePicture, userType, activeOrganizationId }
```

### 1.13 Delete Account for Google Users

**File**: `express-backend/src/controllers/authController.js`

Modify `deleteAccount` to handle Google-only users who have no password:
```javascript
async function deleteAccount(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select('+password');

    if (user.provider === 'google') {
      // For Google-only users, verify by email confirmation
      const { confirmEmail } = req.body;
      if (!confirmEmail || confirmEmail.toLowerCase() !== user.email) {
        return res.status(400).json({ error: 'Please type your email to confirm deletion' });
      }
    } else {
      // For local users, verify password (existing logic)
      const { password } = req.body;
      // ... existing password verification ...
    }

    // ... rest of existing delete logic ...
  }
}
```

---

## Phase 2: User Types + Limits

**Goal**: Distinguish individual and enterprise users. Enforce free tier limits.

**Dependencies**: Phase 1 (userType field on User model).

### 2.1 User Type Selection Screen

After first login (`isNewUser: true` from Google auth, or after email verification), show a selection.

**New file**: `frontend/src/components/auth/UserTypeSelection.jsx`

This component shows two cards:
1. **"I'm an individual"** -- Sets `userType: 'individual'`, proceeds to app
2. **"I'm part of an organization"** -- Shows sub-options:
   - "Create an organization" -- Becomes org owner
   - "Join an organization" -- Enter invite code

### 2.2 Express: Set User Type Endpoint

**File**: `express-backend/src/controllers/authController.js`

Add:
```javascript
/**
 * POST /api/v1/auth/set-user-type
 * Body: { userType: 'individual' | 'enterprise' }
 * Called once after first login.
 */
async function setUserType(req, res, next) {
  try {
    const { userType } = req.body;
    if (!['individual', 'enterprise'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    const user = await User.findById(req.user.userId);
    user.userType = userType;
    await user.save();

    // Create default UserLimits if not exists
    const UserLimits = require('../models/UserLimits');
    await UserLimits.findOneAndUpdate(
      { userId: user._id },
      { userId: user._id, plan: 'free', dataroomLimit: 3, monthlyFileLimit: 500, dailyMessageLimit: 25 },
      { upsert: true, new: true }
    );

    return res.status(200).json({ user: { _id: user._id, userType: user.userType } });
  } catch (error) {
    next(error);
  }
}
```

**File**: `express-backend/src/routes/auth.js`

```javascript
router.post('/set-user-type', authenticate, setUserType);
```

### 2.3 Update UserLimits Model

**File**: `express-backend/src/models/UserLimits.js`

Add these fields:
```javascript
dataroomLimit: {
  type: Number,
  default: 3, // Free tier: 3 DataRooms
},
plan: {
  type: String,
  enum: ['free', 'pro', 'enterprise'],
  default: 'free',
},
```

### 2.4 Plan-to-Limits Mapping

**New file**: `express-backend/src/config/planLimits.js`

```javascript
const PLAN_LIMITS = {
  free: {
    monthlyFileLimit: 500,
    dailyMessageLimit: 25,
    dataroomLimit: 3,
  },
  pro: {
    monthlyFileLimit: 5000,
    dailyMessageLimit: -1, // -1 = unlimited
    dataroomLimit: -1,
  },
  enterprise: {
    monthlyFileLimit: 10000,
    dailyMessageLimit: -1,
    dataroomLimit: -1,
  },
};

module.exports = { PLAN_LIMITS };
```

### 2.5 Express: Check Limits Endpoint

**File**: `express-backend/src/routes/usage.js` (or new route file)

```javascript
/**
 * GET /api/v1/usage/limits
 * Returns current plan limits and usage for the authenticated user.
 */
router.get('/limits', authenticate, async (req, res) => {
  const limits = await UserLimits.findOne({ userId: req.user.userId });
  const usage = await UserUsage.findOne({ userId: req.user.userId });

  res.json({
    plan: limits?.plan || 'free',
    limits: {
      dataroomLimit: limits?.dataroomLimit ?? 3,
      monthlyFileLimit: limits?.monthlyFileLimit ?? 500,
      dailyMessageLimit: limits?.dailyMessageLimit ?? 25,
    },
    usage: {
      filesUploadedThisPeriod: usage?.filesUploadedThisPeriod ?? 0,
      messagesToday: usage?.messagesToday ?? 0,
    },
  });
});
```

### 2.6 Electron: DataRoom Limit Enforcement

**File**: `electron/ipc/dataroomHandlers.js`

Before calling `pythonService.createDataroom()`, check the limit:

```javascript
ipcMain.handle('dataroom:create', async (event, { name, description }) => {
  try {
    // Check DataRoom limit
    const token = authService.getToken();
    const expressUrl = process.env.EXPRESS_URL;
    const limitsRes = await fetch(`${expressUrl}/api/v1/usage/limits`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const limitsData = await limitsRes.json();

    if (limitsData.limits.dataroomLimit !== -1) {
      // Get current DataRoom count from Python
      const datarooms = await pythonService.listDatarooms();
      if (datarooms.length >= limitsData.limits.dataroomLimit) {
        return {
          success: false,
          error: `Free plan allows up to ${limitsData.limits.dataroomLimit} DataRooms. Upgrade to Pro for unlimited.`,
          upgradeRequired: true,
        };
      }
    }

    // Proceed with creation
    const result = await pythonService.createDataroom(name, description);
    return { success: true, dataroom: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### 2.7 Electron: Preload + IPC Updates

**File**: `electron/preload.js`

```javascript
auth: {
  // ... existing ...
  setUserType: (userType) => ipcRenderer.invoke('auth:setUserType', userType),
},
usage: {
  getLimits: () => ipcRenderer.invoke('usage:getLimits'),
},
```

### 2.8 Frontend: Subscription Status in Redux

**File**: `frontend/src/store/authSlice.js`

Extend the state:
```javascript
const initialState = {
  // ... existing ...
  plan: 'free',
  limits: null, // { dataroomLimit, monthlyFileLimit, dailyMessageLimit }
  usage: null,  // { filesUploadedThisPeriod, messagesToday }
};
```

Add a thunk to fetch limits:
```javascript
export const fetchLimits = createAsyncThunk('auth/fetchLimits', async () => {
  return await window.api.usage.getLimits();
});
```

### 2.9 Server-Side Usage Enforcement (Express Middleware)

**Why this is critical**: Sections 2.5-2.6 define limits and enforce them in Electron. But Electron is a desktop client — the Express API endpoints are the real boundary. If someone intercepts the token and calls Express directly, they bypass Electron's checks entirely. **All resource-creation endpoints must also enforce limits server-side.**

**Note on file registration**: File registration goes React → Electron IPC → Python (localhost `127.0.0.1`). Express is never involved. Python is not network-exposed, so Electron enforcement is sufficient for file limits. Server-side enforcement applies to Express-routed operations only.

**New file**: `express-backend/src/middleware/enforceLimits.js`

```javascript
const UserLimits = require('../models/UserLimits');
const UserUsage = require('../models/UserUsage');
const logger = require('../services/logger');

/**
 * Middleware factory for server-side usage enforcement.
 * Usage: router.post('/endpoint', authenticate, enforceLimits('message'), handler)
 *
 * @param {'message' | 'dataroom' | 'file'} resourceType - What resource to check
 * @param {Function} [countFn] - Optional function(req) => number, for batch operations
 *                                 (e.g., counting files in a classify request body)
 */
function enforceLimits(resourceType, countFn) {
  return async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const limits = await UserLimits.findOne({ userId });
      const usage = await UserUsage.findOne({ userId });

      // No limits record = free tier defaults
      const plan = limits?.plan || 'free';

      switch (resourceType) {
        case 'message': {
          const dailyLimit = limits?.dailyMessageLimit ?? 25;
          if (dailyLimit === -1) break; // -1 = unlimited (Pro/Enterprise)

          const todayCount = usage?.messagesToday ?? 0;
          if (todayCount >= dailyLimit) {
            return res.status(403).json({
              error: `Daily message limit reached (${dailyLimit}). Upgrade for unlimited messages.`,
              code: 'LIMIT_EXCEEDED',
              resourceType: 'message',
              limit: dailyLimit,
              current: todayCount,
              plan,
              upgradeRequired: true,
            });
          }
          break;
        }

        case 'dataroom': {
          const dataroomLimit = limits?.dataroomLimit ?? 3;
          if (dataroomLimit === -1) break; // Unlimited

          // Count is checked but actual count comes from Python (SQLite)
          // This is a best-effort guard — Electron also checks with actual count
          // For AI generate-dataroom, the request itself creates a new DataRoom
          break;
        }

        case 'file': {
          const monthlyLimit = limits?.monthlyFileLimit ?? 500;
          if (monthlyLimit === -1) break; // Unlimited

          const currentUsage = usage?.filesUploadedThisPeriod ?? 0;
          const batchSize = countFn ? countFn(req) : 1;

          if (currentUsage + batchSize > monthlyLimit) {
            return res.status(403).json({
              error: `Monthly file limit would be exceeded (${currentUsage}/${monthlyLimit}). Upgrade for more files.`,
              code: 'LIMIT_EXCEEDED',
              resourceType: 'file',
              limit: monthlyLimit,
              current: currentUsage,
              requested: batchSize,
              plan,
              upgradeRequired: true,
            });
          }
          break;
        }
      }

      next();
    } catch (error) {
      // Limit check failure should NOT block the request — log and proceed
      logger.error('enforceLimits middleware error:', error.message);
      next();
    }
  };
}

module.exports = enforceLimits;
```

**Apply to Express routes** — `express-backend/src/routes/ai.js`:

```javascript
const enforceLimits = require('../middleware/enforceLimits');

// Chat endpoints — enforce daily message limit
router.post('/chat/stream', authenticate, enforceLimits('message'), chatStreamHandler);
router.post('/chat', authenticate, enforceLimits('message'), chatHandler);

// Classification — enforce file limit (count files in the batch)
router.post('/classify', authenticate, enforceLimits('file', (req) => {
  return req.body.files?.length || 0;
}), classifyHandler);

// Generate DataRoom — enforce dataroom limit
router.post('/generate-dataroom', authenticate, enforceLimits('dataroom'), generateDataroomHandler);

// Audit/insights/embed — these are read or processing operations, not resource creation
// No limits needed for: /embed, /extract-entities, /summarize-file, /generate-title, /audit, /simulate
```

**Increment usage counters** — After successful operations, increment `UserUsage`:

```javascript
// In the chat handler (after Gemini responds successfully):
await UserUsage.findOneAndUpdate(
  { userId: req.user.userId },
  { $inc: { messagesToday: 1 } },
  { upsert: true }
);

// In the classify handler (after successful classification):
await UserUsage.findOneAndUpdate(
  { userId: req.user.userId },
  { $inc: { filesUploadedThisPeriod: req.body.files.length } },
  { upsert: true }
);
```

**Daily/monthly reset**: Add a TTL or cron mechanism. Options:
- **Simple**: On each request, check if `usage.lastResetDate` is stale. If `messagesToday` was last reset > 24h ago, reset to 0. If `filesUploadedThisPeriod` was last reset > 30d ago, reset to 0.
- **Better**: MongoDB TTL index on `UserUsage.periodStart` that creates a new document each billing period.

```javascript
// Add to UserUsage model:
lastDailyReset: { type: Date, default: Date.now },
lastMonthlyReset: { type: Date, default: Date.now },

// In enforceLimits middleware, before checking counts:
const now = new Date();
const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
if (!usage?.lastDailyReset || usage.lastDailyReset < dayStart) {
  await UserUsage.findOneAndUpdate(
    { userId },
    { messagesToday: 0, lastDailyReset: now },
    { upsert: true }
  );
  // Re-read after reset
}
```

**Frontend handling**: When Express returns `403` with `code: 'LIMIT_EXCEEDED'`, show a toast:
```javascript
// In thunk error handling (any slice that calls AI endpoints):
if (error.code === 'LIMIT_EXCEEDED') {
  dispatch(addToast({
    type: 'warning',
    message: error.error, // "Daily message limit reached..."
    action: { label: 'Upgrade', onClick: () => dispatch(setActivePage('settings')) }
  }));
}
```

---

## Phase 3: Organization Model

**Goal**: Enterprise flow -- create orgs, invite members, manage roles.

**Dependencies**: Phase 2 (user types).

### 3.1 MongoDB Models

**New file**: `express-backend/src/models/Organization.js`

```javascript
const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  plan: {
    type: String,
    enum: ['trial', 'enterprise'],
    default: 'trial',
  },
  maxSeats: { type: Number, default: 5 },
  // Razorpay billing
  razorpayCustomerId: { type: String, default: null },
  razorpaySubscriptionId: { type: String, default: null },
  subscriptionStatus: {
    type: String,
    enum: ['trialing', 'active', 'past_due', 'cancelled', 'expired'],
    default: 'trialing',
  },
  trialEndsAt: { type: Date },
  // Collaboration settings
  allowExternalSharing: { type: Boolean, default: true },
  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);
```

**New file**: `express-backend/src/models/OrganizationMember.js`

```javascript
const mongoose = require('mongoose');

const organizationMemberSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member',
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  invitedAt: { type: Date },
  joinedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['active', 'invited', 'removed'],
    default: 'active',
  },
}, { timestamps: true });

// One membership per user per org
organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('OrganizationMember', organizationMemberSchema);
```

**New file**: `express-backend/src/models/OrganizationInvite.js`

```javascript
const mongoose = require('mongoose');

const organizationInviteSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  email: { type: String, required: true, lowercase: true },
  inviteCode: { type: String, required: true, unique: true },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member',
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'revoked'],
    default: 'pending',
  },
  expiresAt: { type: Date, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 604800, // TTL: 7 days auto-cleanup
  },
});

module.exports = mongoose.model('OrganizationInvite', organizationInviteSchema);
```

### 3.2 Organization Authorization Middleware

**New file**: `express-backend/src/middleware/orgAuthorize.js`

```javascript
const OrganizationMember = require('../models/OrganizationMember');

/**
 * Middleware to check organization membership and role.
 * Usage: router.put('/:orgId', authenticate, orgAuthorize('admin'), handler)
 *
 * Role hierarchy: owner > admin > member
 * 'owner' implicitly has all permissions.
 */
function orgAuthorize(...requiredRoles) {
  return async (req, res, next) => {
    try {
      const orgId = req.params.orgId;
      const userId = req.user.userId;

      const membership = await OrganizationMember.findOne({
        organizationId: orgId,
        userId,
        status: 'active',
      });

      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this organization' });
      }

      // Owner has all permissions
      if (membership.role === 'owner') {
        req.orgMembership = membership;
        return next();
      }

      // Check if user's role is in the required roles
      if (!requiredRoles.includes(membership.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.orgMembership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = orgAuthorize;
```

### 3.3 Organization Endpoints

**New file**: `express-backend/src/routes/organization.js`

```javascript
const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const orgAuthorize = require('../middleware/orgAuthorize');
const orgController = require('../controllers/organizationController');

// Organization CRUD
router.post('/', authenticate, orgController.createOrganization);
router.get('/:orgId', authenticate, orgAuthorize('member'), orgController.getOrganization);
router.put('/:orgId', authenticate, orgAuthorize('admin'), orgController.updateOrganization);
router.delete('/:orgId', authenticate, orgAuthorize('owner'), orgController.deleteOrganization);

// Member management
router.get('/:orgId/members', authenticate, orgAuthorize('member'), orgController.listMembers);
router.put('/:orgId/members/:userId', authenticate, orgAuthorize('admin'), orgController.updateMemberRole);
router.delete('/:orgId/members/:userId', authenticate, orgAuthorize('admin'), orgController.removeMember);

// Invitations
router.post('/:orgId/invites', authenticate, orgAuthorize('admin'), orgController.createInvite);
router.get('/:orgId/invites', authenticate, orgAuthorize('admin'), orgController.listInvites);
router.delete('/:orgId/invites/:inviteId', authenticate, orgAuthorize('admin'), orgController.revokeInvite);

// Accept invite (public-ish, just needs auth)
router.post('/invites/:inviteCode/accept', authenticate, orgController.acceptInvite);
router.get('/invites/:inviteCode', orgController.getInviteDetails); // Public preview

module.exports = router;
```

**New file**: `express-backend/src/controllers/organizationController.js`

Key operations:

```javascript
/**
 * POST /api/v1/organizations
 * Creates org, adds creator as owner, updates user.activeOrganizationId
 */
async function createOrganization(req, res, next) {
  const { name } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const org = await Organization.create({
    name,
    slug,
    createdBy: req.user.userId,
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
  });

  // Add creator as owner
  await OrganizationMember.create({
    organizationId: org._id,
    userId: req.user.userId,
    role: 'owner',
    joinedAt: new Date(),
    status: 'active',
  });

  // Update user
  await User.findByIdAndUpdate(req.user.userId, {
    userType: 'enterprise',
    activeOrganizationId: org._id,
  });

  res.status(201).json({ organization: org });
}

/**
 * POST /api/v1/organizations/:orgId/invites
 * Create an invite and optionally send email.
 */
async function createInvite(req, res, next) {
  const { email, role } = req.body;
  const orgId = req.params.orgId;

  const org = await Organization.findById(orgId);

  // Check seat limit
  const memberCount = await OrganizationMember.countDocuments({
    organizationId: orgId,
    status: 'active',
  });
  if (memberCount >= org.maxSeats) {
    return res.status(400).json({ error: `Seat limit reached (${org.maxSeats}). Upgrade to add more members.` });
  }

  const inviteCode = crypto.randomBytes(16).toString('hex');

  const invite = await OrganizationInvite.create({
    organizationId: orgId,
    email: email.toLowerCase(),
    inviteCode,
    invitedBy: req.user.userId,
    role: role || 'member',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  // Send invite email
  const emailService = require('../services/emailService');
  await emailService.sendOrganizationInviteEmail({
    to: email.toLowerCase(),
    orgName: org.name,
    inviterName: req.user.name || 'A team member',
    inviteCode: invite.inviteCode,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });

  res.status(201).json({ invite: { inviteCode: invite.inviteCode, email: invite.email, expiresAt: invite.expiresAt } });
}

/**
 * POST /api/v1/organizations/invites/:inviteCode/accept
 * Authenticated user accepts the invite.
 */
async function acceptInvite(req, res, next) {
  const invite = await OrganizationInvite.findOne({
    inviteCode: req.params.inviteCode,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });

  if (!invite) {
    return res.status(404).json({ error: 'Invalid or expired invite' });
  }

  // Create membership
  await OrganizationMember.create({
    organizationId: invite.organizationId,
    userId: req.user.userId,
    role: invite.role,
    invitedBy: invite.invitedBy,
    invitedAt: invite.createdAt,
    status: 'active',
  });

  // Update invite status
  invite.status = 'accepted';
  await invite.save();

  // Update user
  await User.findByIdAndUpdate(req.user.userId, {
    userType: 'enterprise',
    activeOrganizationId: invite.organizationId,
  });

  const org = await Organization.findById(invite.organizationId);
  res.json({ organization: org });
}
```

### 3.4 Register Organization Routes

**File**: `express-backend/src/server.js`

```javascript
const organizationRoutes = require('./routes/organization');
app.use('/api/v1/organizations', organizationRoutes);
```

### 3.5 Electron IPC for Organizations

**New file**: `electron/ipc/organizationHandlers.js`

All handlers follow the pattern: get token from authService -> call Express -> return result.

```javascript
const { ipcMain } = require('electron');
const authService = require('../services/authService');
const log = require('../services/logger');

function registerOrganizationHandlers() {
  ipcMain.handle('org:create', async (event, { name }) => {
    const token = authService.getToken();
    const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/organizations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  });

  ipcMain.handle('org:getMembers', async (event, { orgId }) => {
    const token = authService.getToken();
    const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/organizations/${orgId}/members`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.json();
  });

  ipcMain.handle('org:createInvite', async (event, { orgId, email, role }) => {
    const token = authService.getToken();
    const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/organizations/${orgId}/invites`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    return res.json();
  });

  ipcMain.handle('org:acceptInvite', async (event, { inviteCode }) => {
    const token = authService.getToken();
    const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/organizations/invites/${inviteCode}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.json();
  });

  // ... similar handlers for update, delete, removeMember, updateRole, revokeInvite
}

module.exports = { registerOrganizationHandlers };
```

**Electron deep link for invite emails** (`electron/main.js`):

The invite email contains an `orvyn://invite?code=xyz` link. Register the custom protocol so clicking the link opens the app and auto-fills the invite code:

```javascript
// In main.js — app startup
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('orvyn', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('orvyn');
}

// Handle the protocol URL (Windows: comes via second-instance event)
app.on('second-instance', (event, commandLine) => {
  const url = commandLine.find(arg => arg.startsWith('orvyn://'));
  if (url) {
    handleDeepLink(url);
  }
  // Focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function handleDeepLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'invite' || parsed.pathname === '/invite') {
      const inviteCode = parsed.searchParams.get('code');
      if (inviteCode && mainWindow) {
        // Send to renderer to auto-fill JoinOrganization page
        mainWindow.webContents.send('deep-link:invite', { inviteCode });
      }
    }
  } catch (err) {
    log.error('Failed to parse deep link:', err.message);
  }
}
```

**Preload**: Expose the deep link listener:
```javascript
deepLink: {
  onInvite: (callback) => ipcRenderer.on('deep-link:invite', (_, data) => callback(data)),
  offInvite: () => ipcRenderer.removeAllListeners('deep-link:invite'),
},
```

**Frontend** (`JoinOrganization.jsx`): Listen for the deep link and auto-populate the invite code input:
```javascript
useEffect(() => {
  window.api.deepLink.onInvite(({ inviteCode }) => {
    setInviteCode(inviteCode);
  });
  return () => window.api.deepLink.offInvite();
}, []);
```

### 3.6 Preload + Frontend

**File**: `electron/preload.js`

```javascript
organization: {
  create: (payload) => ipcRenderer.invoke('org:create', payload),
  get: (orgId) => ipcRenderer.invoke('org:get', orgId),
  getMembers: (orgId) => ipcRenderer.invoke('org:getMembers', orgId),
  createInvite: (payload) => ipcRenderer.invoke('org:createInvite', payload),
  acceptInvite: (inviteCode) => ipcRenderer.invoke('org:acceptInvite', { inviteCode }),
  removeMember: (payload) => ipcRenderer.invoke('org:removeMember', payload),
  updateMemberRole: (payload) => ipcRenderer.invoke('org:updateMemberRole', payload),
  revokeInvite: (payload) => ipcRenderer.invoke('org:revokeInvite', payload),
  update: (payload) => ipcRenderer.invoke('org:update', payload),
  delete: (orgId) => ipcRenderer.invoke('org:delete', orgId),
},
```

**New Redux slice**: `frontend/src/store/organizationSlice.js`

```javascript
const initialState = {
  organization: null,   // Current user's organization
  members: [],          // Organization members
  invites: [],          // Pending invites
  isLoading: false,
  error: null,
};

// Thunks: fetchOrganization, fetchMembers, createOrganization,
//         createInvite, acceptInvite, removeMember, updateMemberRole
```

**New frontend pages:**
- `frontend/src/pages/OrganizationSettings.jsx` -- Members list, invite form, billing, settings
- `frontend/src/components/auth/CreateOrganization.jsx` -- Org creation form
- `frontend/src/components/auth/JoinOrganization.jsx` -- Invite code entry

### 3.7 Email Service for Invites & Notifications

**New file**: `express-backend/src/services/emailService.js`

This service uses the same nodemailer transporter from `authService.js`. Extract the transporter setup into a shared utility, or import `sendEmail` directly from `authService.js`. Below shows a dedicated email service for V2 emails:

```javascript
const { sendEmail } = require('./authService'); // Reuse existing transporter
const logger = require('./logger');

/**
 * Send organization invite email with invite code + deep link.
 */
async function sendOrganizationInviteEmail({ to, orgName, inviterName, inviteCode, role, expiresAt }) {
  const appDeepLink = `orvyn://invite?code=${inviteCode}`;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const subject = `You're invited to join ${orgName} on Orvyn`;
  const text = [
    `${inviterName} has invited you to join "${orgName}" on Orvyn as a ${role}.`,
    '',
    `To accept this invite:`,
    `1. Open Orvyn and go to "Join Organization"`,
    `2. Enter this invite code: ${inviteCode}`,
    '',
    `Or click this link to open directly in the app: ${appDeepLink}`,
    '',
    `This invite expires on ${expiryDate}.`,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">You're invited to join ${orgName}</h2>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Orvyn as a <strong>${role}</strong>.</p>
      <div style="background: #f4f4f8; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #666;">Your invite code</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 0; color: #1a1a2e;">${inviteCode}</p>
      </div>
      <p>Open Orvyn → <strong>Join Organization</strong> → paste the code above.</p>
      <p style="margin-top: 16px;">
        <a href="${appDeepLink}" style="background: #5c5ce0; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
          Open in Orvyn
        </a>
      </p>
      <p style="color: #999; font-size: 13px; margin-top: 24px;">This invite expires on ${expiryDate}.</p>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
  logger.info(`Invite email sent to ${to} for org ${orgName}`);
}

/**
 * Send payment success email with receipt details.
 */
async function sendPaymentSuccessEmail({ to, userName, plan, amount, currency, paymentId, invoiceUrl, billingPeriod }) {
  const subject = `Payment received — Orvyn ${plan === 'pro' ? 'Pro' : 'Enterprise'}`;
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(amount / 100);

  const text = [
    `Hi ${userName},`,
    '',
    `Your payment of ${formattedAmount} for Orvyn ${plan === 'pro' ? 'Pro' : 'Enterprise'} has been received.`,
    '',
    `Payment ID: ${paymentId}`,
    `Plan: ${plan === 'pro' ? 'Individual Pro' : 'Enterprise'}`,
    `Billing period: ${billingPeriod}`,
    invoiceUrl ? `Invoice: ${invoiceUrl}` : '',
    '',
    `Thank you for using Orvyn!`,
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Payment Confirmed</h2>
      <p>Hi ${userName},</p>
      <p>Your payment has been successfully processed.</p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #666;">Amount</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${formattedAmount}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Plan</td><td style="padding: 6px 0; text-align: right;">${plan === 'pro' ? 'Individual Pro' : 'Enterprise'}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Payment ID</td><td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 13px;">${paymentId}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Period</td><td style="padding: 6px 0; text-align: right;">${billingPeriod}</td></tr>
        </table>
      </div>
      ${invoiceUrl ? `<p><a href="${invoiceUrl}" style="color: #5c5ce0;">Download Invoice / Receipt</a></p>` : ''}
      <p style="color: #999; font-size: 13px;">Thank you for using Orvyn!</p>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
  logger.info(`Payment success email sent to ${to}, paymentId: ${paymentId}`);
}

/**
 * Send payment failure email with next steps.
 */
async function sendPaymentFailureEmail({ to, userName, plan, amount, currency, reason, retryUrl }) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(amount / 100);
  const subject = `Payment failed — Orvyn ${plan === 'pro' ? 'Pro' : 'Enterprise'}`;

  const text = [
    `Hi ${userName},`,
    '',
    `Your payment of ${formattedAmount} for Orvyn ${plan === 'pro' ? 'Pro' : 'Enterprise'} could not be processed.`,
    '',
    `Reason: ${reason || 'Payment was declined by your bank or card issuer.'}`,
    '',
    `What happens next:`,
    `- Razorpay will automatically retry the payment within 3 days`,
    `- Your subscription remains active during the retry window`,
    `- If all retries fail, your plan will be downgraded to Free`,
    '',
    `No manual refund is needed — failed payments are NOT charged. If any amount was held, your bank will auto-release it within 5-7 business days.`,
    '',
    retryUrl ? `Update payment method: ${retryUrl}` : '',
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Payment Failed</h2>
      <p>Hi ${userName},</p>
      <p>Your payment of <strong>${formattedAmount}</strong> for <strong>Orvyn ${plan === 'pro' ? 'Pro' : 'Enterprise'}</strong> could not be processed.</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b;"><strong>Reason:</strong> ${reason || 'Payment was declined by your bank or card issuer.'}</p>
      </div>
      <h3 style="margin-top: 24px;">What happens next?</h3>
      <ul>
        <li>Razorpay will <strong>automatically retry</strong> the payment within 3 days</li>
        <li>Your subscription remains active during the retry window</li>
        <li>If all retries fail, your plan will be downgraded to Free</li>
      </ul>
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-size: 13px; color: #1e40af;">
          <strong>No refund needed</strong> — failed payments are NOT charged. If any amount was temporarily held, your bank will auto-release it within 5–7 business days.
        </p>
      </div>
      ${retryUrl ? `<p><a href="${retryUrl}" style="background: #5c5ce0; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Update Payment Method</a></p>` : ''}
    </div>
  `;

  await sendEmail({ to, subject, text, html });
  logger.info(`Payment failure email sent to ${to}`);
}

/**
 * Send sharing notification email.
 */
async function sendDataRoomSharedEmail({ to, sharerName, dataRoomName }) {
  const subject = `${sharerName} shared a DataRoom with you on Orvyn`;
  const text = `${sharerName} shared the DataRoom "${dataRoomName}" with you. Open Orvyn to view it.`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">DataRoom Shared With You</h2>
      <p><strong>${sharerName}</strong> shared the DataRoom <strong>"${dataRoomName}"</strong> with you.</p>
      <p>Open Orvyn to view the shared DataRoom in your "Shared with me" section.</p>
    </div>
  `;
  await sendEmail({ to, subject, text, html });
}

module.exports = {
  sendOrganizationInviteEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailureEmail,
  sendDataRoomSharedEmail,
};
```

**Note**: The `sendEmail` function imported from `authService.js` already handles the dev fallback (logs instead of sending when SMTP is not configured). All V2 emails flow through the same transporter.

---

## Phase 4: Razorpay Integration

**Goal**: Payment processing for Individual Pro and Enterprise plans.

**Dependencies**: Phase 2 (limits). Can be built in parallel with Phase 3.

### 4.1 Razorpay Setup (Step-by-Step)

**How big companies handle payments for desktop apps:**
Companies like Notion, Figma, Slack, and 1Password do NOT process payments inside the desktop app. They open a **web page** hosted on their own server for checkout. This is because:
- Payment SDKs (Razorpay, Stripe) need a web browser context (CSP, cookies, redirects)
- PCI compliance is simpler when payment happens on a web page, not inside Electron
- Users trust browser-based payment forms more than embedded app forms

**Orvyn's approach**: Express will serve a minimal web checkout page. When users click "Upgrade" in the desktop app, Electron opens the system browser to `https://your-express-url/checkout/...`. After payment, Razorpay redirects to a success/failure page on Express, and the desktop app picks up the new subscription status via polling.

**Setup steps:**

1. **Sign up** at [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Toggle to **Test Mode** (top-right switch in dashboard)
3. Go to **Settings → API Keys → Generate Key**
   - Copy **Key ID** (starts with `rzp_test_`)
   - Copy **Key Secret** (shown only once — save it immediately)
4. Go to **Products → Subscriptions → Plans → Create Plan**
   - **Plan 1 — Individual Pro**:
     - Name: `Orvyn Pro`
     - Period: `Monthly`
     - Amount: your price in INR (e.g., 499)
     - Description: `Orvyn Individual Pro Plan`
     - Click Create → copy the **Plan ID** (starts with `plan_`)
   - **Plan 2 — Enterprise Seat**:
     - Name: `Orvyn Enterprise`
     - Period: `Monthly`
     - Amount: per-seat price in INR (e.g., 299)
     - Description: `Orvyn Enterprise per seat`
     - Click Create → copy the **Plan ID**
5. **Set up webhook**:
   - Go to **Settings → Webhooks → Add New Webhook**
   - URL: `https://your-express-domain/api/v1/webhooks/razorpay`
   - Events to subscribe:
     - `subscription.activated`
     - `subscription.charged`
     - `subscription.cancelled`
     - `subscription.halted`
     - `payment.failed`
   - Copy the **Webhook Secret** shown after creation
6. **For going live later**: Switch to Live mode, re-generate keys, complete KYC, update env vars

### 4.1b Express: Web Page Serving for Checkout

**This is a critical addition.** Express is currently a pure API server with no web page capability. To handle payments like big companies, add minimal web page serving:

**File**: `express-backend/src/server.js` — add these lines:

```javascript
const path = require('path');

// Serve static checkout pages (CSS, JS for Razorpay checkout UI)
app.use('/static', express.static(path.join(__dirname, '../public')));

// View engine for checkout pages
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
```

**New dependency**:
```bash
cd express-backend
npm install ejs
```

**New directory structure**:
```
express-backend/
├── views/
│   ├── checkout.ejs        # Razorpay checkout page
│   ├── payment-success.ejs # Post-payment success page
│   └── payment-failure.ejs # Post-payment failure page
├── public/
│   └── css/
│       └── checkout.css    # Checkout page styles
```

**New file**: `express-backend/views/checkout.ejs`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Orvyn — Upgrade to <%= planName %></title>
  <link rel="stylesheet" href="/static/css/checkout.css">
</head>
<body>
  <div class="checkout-container">
    <h1>Upgrade to Orvyn <%= planName %></h1>
    <p class="price"><%= formattedPrice %>/month</p>
    <p class="description"><%= planDescription %></p>

    <button id="pay-btn" class="pay-button">Pay with Razorpay</button>
    <p class="secure-note">Secured by Razorpay. We never store your card details.</p>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var options = {
      key: '<%= razorpayKeyId %>',
      subscription_id: '<%= subscriptionId %>',
      name: 'Orvyn',
      description: '<%= planDescription %>',
      handler: function(response) {
        // Payment success — redirect to success page
        window.location.href = '/checkout/success?subscription_id=<%= subscriptionId %>';
      },
      prefill: {
        email: '<%= userEmail %>',
        name: '<%= userName %>',
      },
      theme: { color: '#5c5ce0' },
      modal: {
        ondismiss: function() {
          // User closed the checkout modal
          document.getElementById('pay-btn').textContent = 'Try Again';
        }
      }
    };

    document.getElementById('pay-btn').onclick = function() {
      var rzp = new Razorpay(options);
      rzp.open();
    };
  </script>
</body>
</html>
```

**New checkout routes** — add to `express-backend/src/routes/billing.js`:

```javascript
// Serve checkout page (opened in system browser from Electron)
router.get('/checkout/:token', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    // Token is a short-lived JWT (5 min) containing userId + plan info
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
    const { userId, plan, subscriptionId, planName, formattedPrice, planDescription, userEmail, userName } = decoded;

    res.render('checkout', {
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      subscriptionId,
      planName,
      formattedPrice,
      planDescription,
      userEmail,
      userName,
    });
  } catch (error) {
    res.status(400).send('Invalid or expired checkout link. Please try again from the Orvyn app.');
  }
});

// Success page after payment
router.get('/checkout/success', (req, res) => {
  res.render('payment-success', {
    message: 'Payment successful! You can close this tab and return to Orvyn.',
  });
});

// Failure page
router.get('/checkout/failure', (req, res) => {
  res.render('payment-failure', {
    message: 'Payment could not be processed. Please try again from the Orvyn app.',
  });
});
```

**Updated checkout flow** (how it works end-to-end):
```
User clicks "Upgrade" in Electron
  → Electron IPC → Express POST /api/v1/billing/create-checkout-session
  → Express creates Razorpay subscription + generates short-lived JWT checkout token
  → Returns { checkoutUrl: 'https://your-express/billing/checkout/<jwt-token>' }
  → Electron opens checkoutUrl in system browser (shell.openExternal)
  → Browser loads Express-hosted checkout page with Razorpay JS SDK
  → User completes payment in browser
  → Razorpay webhook → Express updates subscription status + sends receipt email
  → Electron polls /api/v1/billing/status every 30 seconds
  → Desktop UI updates to show Pro/Enterprise features
```

### 4.2 Express: New Dependency

```bash
cd express-backend
npm install razorpay
```

### 4.3 Express: Environment Variables

**File**: `express-backend/.env`

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_PLAN_ID_PRO=plan_xxxxxxxxxx
RAZORPAY_PLAN_ID_ENTERPRISE=plan_xxxxxxxxxx
```

**File**: `express-backend/.env.example`

```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_PLAN_ID_PRO=
RAZORPAY_PLAN_ID_ENTERPRISE=
```

### 4.4 Subscription Model

**New file**: `express-backend/src/models/Subscription.js`

```javascript
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // For individual: userId set, organizationId null
  // For enterprise: organizationId set, userId null
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'past_due', 'cancelled', 'expired', 'trialing'],
    default: 'active',
  },
  razorpaySubscriptionId: { type: String, default: null },
  razorpayCustomerId: { type: String, default: null },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelledAt: { type: Date },
  seats: { type: Number, default: 1 },
}, { timestamps: true });

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
```

### 4.5 Razorpay Service

**New file**: `express-backend/src/services/razorpayService.js`

```javascript
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const UserLimits = require('../models/UserLimits');
const { PLAN_LIMITS } = require('../config/planLimits');
const logger = require('./logger');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Razorpay subscription for an individual user.
 */
async function createIndividualSubscription(userId, userEmail, userName) {
  // Create or retrieve Razorpay customer
  const customer = await razorpay.customers.create({
    name: userName,
    email: userEmail,
  });

  // Create subscription
  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID_PRO,
    customer_id: customer.id,
    total_count: 12, // 12 billing cycles
    customer_notify: 1,
  });

  // Store in MongoDB
  await Subscription.create({
    userId,
    plan: 'pro',
    status: 'trialing',
    razorpaySubscriptionId: subscription.id,
    razorpayCustomerId: customer.id,
  });

  return {
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url, // Razorpay-hosted checkout page
  };
}

/**
 * Create a Razorpay subscription for an organization.
 */
async function createEnterpriseSubscription(organizationId, seats, adminEmail, orgName) {
  const customer = await razorpay.customers.create({
    name: orgName,
    email: adminEmail,
  });

  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID_ENTERPRISE,
    customer_id: customer.id,
    quantity: seats,
    total_count: 12,
    customer_notify: 1,
  });

  await Subscription.create({
    organizationId,
    plan: 'enterprise',
    status: 'trialing',
    razorpaySubscriptionId: subscription.id,
    razorpayCustomerId: customer.id,
    seats,
  });

  return {
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url,
  };
}

/**
 * Verify Razorpay webhook signature.
 */
function verifyWebhookSignature(body, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

/**
 * Handle Razorpay webhook events.
 * Sends email notifications for payment success/failure.
 */
async function handleWebhookEvent(event, payload) {
  const subscriptionId = payload.subscription?.entity?.id;
  const paymentEntity = payload.payment?.entity;
  const emailService = require('./emailService');

  switch (event) {
    case 'subscription.activated': {
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'active';
        sub.currentPeriodStart = new Date();
        sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await sub.save();
        await updateUserLimits(sub);
      }
      break;
    }

    case 'subscription.charged': {
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'active';
        sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await sub.save();

        // Send payment success email with receipt
        const { email, userName } = await getSubscriptionOwnerDetails(sub);
        if (email) {
          const invoiceId = paymentEntity?.invoice_id;
          let invoiceUrl = null;
          if (invoiceId) {
            try {
              const invoice = await razorpay.invoices.fetch(invoiceId);
              invoiceUrl = invoice.short_url; // Razorpay-hosted invoice/receipt URL
            } catch (e) {
              logger.warn(`Could not fetch invoice ${invoiceId}: ${e.message}`);
            }
          }

          await emailService.sendPaymentSuccessEmail({
            to: email,
            userName,
            plan: sub.plan,
            amount: paymentEntity?.amount || 0,
            currency: paymentEntity?.currency || 'INR',
            paymentId: paymentEntity?.id || 'N/A',
            invoiceUrl,
            billingPeriod: `${sub.currentPeriodStart?.toLocaleDateString('en-IN')} – ${sub.currentPeriodEnd?.toLocaleDateString('en-IN')}`,
          });
        }
      }
      break;
    }

    case 'subscription.cancelled': {
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'cancelled';
        sub.cancelledAt = new Date();
        await sub.save();
        await downgradeToFree(sub);
      }
      break;
    }

    case 'subscription.halted': {
      // Halted = all payment retries exhausted. Downgrade to free.
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'past_due';
        await sub.save();
        await downgradeToFree(sub);

        const { email, userName } = await getSubscriptionOwnerDetails(sub);
        if (email) {
          await emailService.sendPaymentFailureEmail({
            to: email,
            userName,
            plan: sub.plan,
            amount: paymentEntity?.amount || 0,
            currency: paymentEntity?.currency || 'INR',
            reason: 'All automatic retry attempts have failed. Your plan has been downgraded to Free.',
          });
        }
      }
      break;
    }

    case 'payment.failed': {
      // Individual payment attempt failed. Razorpay auto-retries (up to 3 times).
      // Notify user but do NOT downgrade yet.
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'past_due';
        await sub.save();

        const { email, userName } = await getSubscriptionOwnerDetails(sub);
        if (email) {
          // Get update payment method URL from Razorpay
          let retryUrl = null;
          try {
            const rzpSub = await razorpay.subscriptions.fetch(subscriptionId);
            retryUrl = rzpSub.short_url; // Allows user to update payment method
          } catch (e) {
            logger.warn(`Could not fetch subscription URL: ${e.message}`);
          }

          await emailService.sendPaymentFailureEmail({
            to: email,
            userName,
            plan: sub.plan,
            amount: paymentEntity?.amount || 0,
            currency: paymentEntity?.currency || 'INR',
            reason: paymentEntity?.error_description || 'Payment was declined by your bank or card issuer.',
            retryUrl,
          });
        }
      }
      break;
    }

    default:
      logger.info(`Unhandled Razorpay event: ${event}`);
  }
}

/**
 * Get email and name of the subscription owner (individual user or org admin).
 */
async function getSubscriptionOwnerDetails(subscription) {
  const User = require('../models/User');

  if (subscription.userId) {
    const user = await User.findById(subscription.userId);
    return { email: user?.email, userName: user?.name || 'User' };
  }

  if (subscription.organizationId) {
    const Organization = require('../models/Organization');
    const org = await Organization.findById(subscription.organizationId);
    if (org) {
      const admin = await User.findById(org.createdBy);
      return { email: admin?.email, userName: org.name };
    }
  }

  return { email: null, userName: 'User' };
}

### Payment Failure & Refund Behavior

**How Razorpay handles failed payments (no custom code needed):**

1. **First attempt fails** → Razorpay sends `payment.failed` webhook → your app emails the user + marks subscription `past_due` → user keeps current plan during retry window
2. **Razorpay auto-retries** up to 3 times over 3 days (configurable in Razorpay Dashboard → Settings → Subscriptions → Retry Settings)
3. **If a retry succeeds** → Razorpay sends `subscription.charged` webhook → your app emails receipt + restores `active` status
4. **If ALL retries fail** → Razorpay sends `subscription.halted` webhook → your app downgrades to Free + emails final notice

**Refund behavior:**
- **Failed payments are NOT charged** — no money leaves the user's account, so no refund is needed
- If a temporary hold/authorization was placed, the bank automatically releases it within 5–7 business days (this is handled entirely by the bank, not Razorpay or your app)
- **For actual refunds** (e.g., user cancels mid-cycle and wants a prorated refund), use the Razorpay SDK:

```javascript
/**
 * Issue a refund for a specific payment (optional — for cancellation refunds).
 */
async function issueRefund(paymentId, amountInPaise, reason) {
  const refund = await razorpay.payments.refund(paymentId, {
    amount: amountInPaise, // Partial refund in paise; omit for full refund
    notes: { reason },
  });
  logger.info(`Refund issued: ${refund.id} for payment ${paymentId}`);
  return refund;
}
```

Add `issueRefund` to the exports of `razorpayService.js` and create an admin endpoint if you want manual refund capability later.

/**
 * Update UserLimits based on subscription plan.
 */
async function updateUserLimits(subscription) {
  const limits = PLAN_LIMITS[subscription.plan];
  if (!limits) return;

  if (subscription.userId) {
    await UserLimits.findOneAndUpdate(
      { userId: subscription.userId },
      { ...limits, plan: subscription.plan },
      { upsert: true }
    );
  } else if (subscription.organizationId) {
    // For enterprise: update limits for ALL org members
    const OrganizationMember = require('../models/OrganizationMember');
    const members = await OrganizationMember.find({
      organizationId: subscription.organizationId,
      status: 'active',
    });

    for (const member of members) {
      await UserLimits.findOneAndUpdate(
        { userId: member.userId },
        { ...limits, plan: subscription.plan },
        { upsert: true }
      );
    }
  }
}

/**
 * Downgrade to free plan limits.
 */
async function downgradeToFree(subscription) {
  const freeLimits = PLAN_LIMITS.free;
  if (subscription.userId) {
    await UserLimits.findOneAndUpdate(
      { userId: subscription.userId },
      { ...freeLimits, plan: 'free' }
    );
  }
  // For enterprise: org members keep enterprise limits until period end
}

/**
 * Get current subscription status.
 */
async function getSubscriptionStatus(userId) {
  // Check individual subscription
  let sub = await Subscription.findOne({
    userId,
    status: { $in: ['active', 'trialing', 'past_due'] },
  });

  if (sub) {
    return {
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  // Check if user is part of an enterprise org with active subscription
  const User = require('../models/User');
  const user = await User.findById(userId);
  if (user?.activeOrganizationId) {
    sub = await Subscription.findOne({
      organizationId: user.activeOrganizationId,
      status: { $in: ['active', 'trialing', 'past_due'] },
    });
    if (sub) {
      return {
        plan: 'enterprise',
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        organizationId: user.activeOrganizationId,
      };
    }
  }

  return { plan: 'free', status: 'active' };
}

module.exports = {
  createIndividualSubscription,
  createEnterpriseSubscription,
  verifyWebhookSignature,
  handleWebhookEvent,
  getSubscriptionStatus,
};
```

### 4.6 Billing Routes

**New file**: `express-backend/src/routes/billing.js`

```javascript
const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const razorpayService = require('../services/razorpayService');
const logger = require('../services/logger');

// Create checkout session (individual)
router.post('/create-checkout-session', authenticate, async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);

    const { plan, organizationId, seats } = req.body;

    let result;
    if (plan === 'pro') {
      result = await razorpayService.createIndividualSubscription(
        user._id, user.email, user.name
      );
    } else if (plan === 'enterprise' && organizationId) {
      result = await razorpayService.createEnterpriseSubscription(
        organizationId, seats || 5, user.email, user.name
      );
    } else {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    res.json({ checkoutUrl: result.shortUrl, subscriptionId: result.subscriptionId });
  } catch (error) {
    next(error);
  }
});

// Get subscription status
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const status = await razorpayService.getSubscriptionStatus(req.user.userId);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// Cancel subscription
router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    const Subscription = require('../models/Subscription');
    const sub = await Subscription.findOne({
      userId: req.user.userId,
      status: { $in: ['active', 'trialing'] },
    });

    if (!sub) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel on Razorpay
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId);

    sub.status = 'cancelled';
    sub.cancelledAt = new Date();
    await sub.save();

    res.json({ message: 'Subscription cancelled. Access continues until period end.' });
  } catch (error) {
    next(error);
  }
});

// Razorpay webhook (NO auth middleware -- verified by signature)
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = JSON.stringify(req.body);

    if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid Razorpay webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const { event, payload } = req.body;
    await razorpayService.handleWebhookEvent(event, payload);

    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
```

### 4.7 Register Billing Routes

**File**: `express-backend/src/server.js`

```javascript
const billingRoutes = require('./routes/billing');
app.use('/api/v1/billing', billingRoutes);
// Webhook needs raw body for signature verification
// Make sure express.json() runs before billing routes, or handle raw body in webhook
```

**Important**: For webhook signature verification, you may need the raw request body. If using `express.json()` globally, add raw body preservation:

```javascript
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.includes('/webhook')) {
      req.rawBody = buf.toString();
    }
  },
}));
```

Then in the webhook handler, use `req.rawBody` instead of `JSON.stringify(req.body)`.

### 4.8 Electron: Billing IPC

**New file**: `electron/ipc/billingHandlers.js`

```javascript
const { ipcMain, shell } = require('electron');
const authService = require('../services/authService');

function registerBillingHandlers() {
  // Create checkout and open in browser
  ipcMain.handle('billing:upgrade', async (event, { plan, organizationId, seats }) => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, organizationId, seats }),
      });
      const data = await res.json();

      if (data.checkoutUrl) {
        // Open Razorpay checkout in system browser
        shell.openExternal(data.checkoutUrl);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Check subscription status
  ipcMain.handle('billing:status', async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/billing/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (error) {
      return { plan: 'free', status: 'active' };
    }
  });

  // Cancel subscription
  ipcMain.handle('billing:cancel', async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/billing/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (error) {
      return { error: error.message };
    }
  });
}

module.exports = { registerBillingHandlers };
```

### 4.9 Periodic Subscription Check

**File**: `electron/ipc/authHandlers.js`

After login (in both email and Google login handlers), start a periodic subscription check:

```javascript
// Start periodic subscription status check (every 30 minutes)
let subscriptionCheckInterval = null;

function startSubscriptionCheck() {
  if (subscriptionCheckInterval) clearInterval(subscriptionCheckInterval);
  subscriptionCheckInterval = setInterval(async () => {
    try {
      const token = authService.getToken();
      if (!token) return;
      const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/billing/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const status = await res.json();
      // Notify renderer of status update
      const { BrowserWindow } = require('electron');
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('billing:statusUpdate', status);
    } catch (e) { /* ignore network errors */ }
  }, 30 * 60 * 1000); // 30 minutes
}
```

### 4.10 Frontend: Billing UI

**File**: `electron/preload.js`

```javascript
billing: {
  upgrade: (payload) => ipcRenderer.invoke('billing:upgrade', payload),
  getStatus: () => ipcRenderer.invoke('billing:status'),
  cancel: () => ipcRenderer.invoke('billing:cancel'),
  onStatusUpdate: (callback) => ipcRenderer.on('billing:statusUpdate', (_, data) => callback(data)),
},
```

**New Redux slice**: `frontend/src/store/billingSlice.js`

```javascript
const initialState = {
  plan: 'free',
  status: 'active',
  currentPeriodEnd: null,
  isLoading: false,
};
```

**New component**: `frontend/src/components/settings/BillingSettings.jsx`

Shows current plan, upgrade button, cancel option, usage stats.

---

## Phase 5: Collaboration / DataRoom Sharing

**Goal**: Users can share DataRooms with other users.

**Dependencies**: Phase 2 (user types).

### 5.1 MongoDB Models for Sharing

**New file**: `express-backend/src/models/SharedDataRoom.js`

```javascript
const mongoose = require('mongoose');

const sharedDataRoomSchema = new mongoose.Schema({
  // Source DataRoom (UUID from sharer's SQLite)
  sourceDataroomId: { type: String, required: true },
  sourceDataroomName: { type: String, required: true },
  sourceDataroomDescription: { type: String, default: '' },

  // Owner (sharer)
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerName: { type: String, required: true },

  // Snapshot data
  folderTree: { type: mongoose.Schema.Types.Mixed, required: true },
  // Each file: { id, original_name, file_extension, size_bytes, extracted_text,
  //              ai_summary, folder_id, classification_confidence,
  //              classification_reasoning, entities: [{ type, value, context }] }
  files: [{ type: mongoose.Schema.Types.Mixed }],

  fileCount: { type: Number, default: 0 },
  folderCount: { type: Number, default: 0 },
  snapshotVersion: { type: Number, default: 1 },
  snapshotCreatedAt: { type: Date, default: Date.now },

  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

sharedDataRoomSchema.index({ ownerId: 1 });

module.exports = mongoose.model('SharedDataRoom', sharedDataRoomSchema);
```

**New file**: `express-backend/src/models/SharedDataRoomAccess.js`

```javascript
const mongoose = require('mongoose');

const sharedDataRoomAccessSchema = new mongoose.Schema({
  sharedDataRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SharedDataRoom',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  permission: {
    type: String,
    enum: ['viewer', 'editor'],
    default: 'viewer',
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active',
  },
  // Track if recipient has seen the latest version
  lastViewedVersion: { type: Number, default: 0 },
}, { timestamps: true });

sharedDataRoomAccessSchema.index({ sharedDataRoomId: 1, userId: 1 }, { unique: true });
sharedDataRoomAccessSchema.index({ userId: 1, status: 1 }); // For "shared with me" queries

module.exports = mongoose.model('SharedDataRoomAccess', sharedDataRoomAccessSchema);
```

### 5.2 Sharing Routes

**New file**: `express-backend/src/routes/sharing.js`

```javascript
const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const sharingController = require('../controllers/sharingController');

// Share a DataRoom (create snapshot)
router.post('/datarooms', authenticate, sharingController.createSharedDataRoom);

// Update shared snapshot (re-share with latest data)
router.put('/datarooms/:shareId', authenticate, sharingController.updateSharedDataRoom);

// Delete shared DataRoom
router.delete('/datarooms/:shareId', authenticate, sharingController.deleteSharedDataRoom);

// Grant access to a user
router.post('/datarooms/:shareId/access', authenticate, sharingController.grantAccess);

// Revoke user access
router.delete('/datarooms/:shareId/access/:userId', authenticate, sharingController.revokeAccess);

// List who has access
router.get('/datarooms/:shareId/access', authenticate, sharingController.listAccess);

// List my shared DataRooms (ones I shared)
router.get('/my-shares', authenticate, sharingController.listMyShares);

// List DataRooms shared with me
router.get('/received', authenticate, sharingController.listReceived);

// Get shared DataRoom snapshot data
router.get('/received/:shareId', authenticate, sharingController.getSharedDataRoom);

// Search users for sharing
router.get('/users/search', authenticate, sharingController.searchUsers);

module.exports = router;
```

### 5.3 Sharing Controller

**New file**: `express-backend/src/controllers/sharingController.js`

```javascript
const SharedDataRoom = require('../models/SharedDataRoom');
const SharedDataRoomAccess = require('../models/SharedDataRoomAccess');
const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const logger = require('../services/logger');

/**
 * POST /api/v1/sharing/datarooms
 * Create a shared DataRoom snapshot.
 * Body: { sourceDataroomId, name, description, folderTree, files }
 */
async function createSharedDataRoom(req, res, next) {
  try {
    const { sourceDataroomId, name, description, folderTree, files, recipientEmail } = req.body;
    const user = await User.findById(req.user.userId);

    // Check external sharing restriction for enterprise users
    if (user.activeOrganizationId) {
      const org = await Organization.findById(user.activeOrganizationId);
      const recipient = await User.findOne({ email: recipientEmail.toLowerCase(), isDeleted: false });

      if (recipient && !org.allowExternalSharing) {
        // Check if recipient is in the same org
        const recipientMembership = await OrganizationMember.findOne({
          organizationId: user.activeOrganizationId,
          userId: recipient._id,
          status: 'active',
        });
        if (!recipientMembership) {
          return res.status(403).json({
            error: 'Your organization does not allow sharing with external users',
          });
        }
      }
    }

    const shared = await SharedDataRoom.create({
      sourceDataroomId,
      sourceDataroomName: name,
      sourceDataroomDescription: description || '',
      ownerId: req.user.userId,
      ownerName: user.name,
      folderTree,
      files,
      fileCount: files.length,
      folderCount: countFolders(folderTree),
      snapshotVersion: 1,
    });

    // Grant access to recipient
    if (recipientEmail) {
      const recipient = await User.findOne({ email: recipientEmail.toLowerCase(), isDeleted: false });
      if (recipient) {
        await SharedDataRoomAccess.create({
          sharedDataRoomId: shared._id,
          userId: recipient._id,
          permission: 'viewer',
          grantedBy: req.user.userId,
        });

        // Send sharing notification email
        const emailService = require('../services/emailService');
        await emailService.sendDataRoomSharedEmail({
          to: recipient.email,
          sharerName: user.name,
          dataRoomName: name,
        });
      } else {
        logger.info(`Recipient ${recipientEmail} not found for sharing`);
      }
    }

    res.status(201).json({ sharedDataRoom: shared });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/sharing/datarooms/:shareId
 * Update snapshot with latest data (manual re-share).
 */
async function updateSharedDataRoom(req, res, next) {
  try {
    const shared = await SharedDataRoom.findOne({
      _id: req.params.shareId,
      ownerId: req.user.userId,
      isDeleted: false,
    });

    if (!shared) return res.status(404).json({ error: 'Shared DataRoom not found' });

    const { folderTree, files } = req.body;
    shared.folderTree = folderTree;
    shared.files = files;
    shared.fileCount = files.length;
    shared.folderCount = countFolders(folderTree);
    shared.snapshotVersion += 1;
    shared.snapshotCreatedAt = new Date();
    await shared.save();

    res.json({ sharedDataRoom: shared });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/sharing/datarooms/:shareId/access
 * Grant access to another user.
 */
async function grantAccess(req, res, next) {
  try {
    const shared = await SharedDataRoom.findOne({
      _id: req.params.shareId,
      ownerId: req.user.userId,
    });
    if (!shared) return res.status(404).json({ error: 'Not found' });

    const { email, permission } = req.body;
    const recipient = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (!recipient) return res.status(404).json({ error: 'User not found' });

    const access = await SharedDataRoomAccess.findOneAndUpdate(
      { sharedDataRoomId: shared._id, userId: recipient._id },
      {
        sharedDataRoomId: shared._id,
        userId: recipient._id,
        permission: permission || 'viewer',
        grantedBy: req.user.userId,
        status: 'active',
      },
      { upsert: true, new: true }
    );

    res.json({ access });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/sharing/received
 * List DataRooms shared with the current user.
 */
async function listReceived(req, res, next) {
  try {
    const accesses = await SharedDataRoomAccess.find({
      userId: req.user.userId,
      status: 'active',
    }).sort({ createdAt: -1 });

    const shareIds = accesses.map(a => a.sharedDataRoomId);
    const sharedDataRooms = await SharedDataRoom.find({
      _id: { $in: shareIds },
      isDeleted: false,
    }).select('-files -folderTree'); // Light response for listing

    // Merge with access info
    const result = sharedDataRooms.map(sdr => {
      const access = accesses.find(a => a.sharedDataRoomId.toString() === sdr._id.toString());
      return {
        ...sdr.toObject(),
        permission: access.permission,
        hasUpdate: sdr.snapshotVersion > (access.lastViewedVersion || 0),
      };
    });

    res.json({ received: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/sharing/received/:shareId
 * Get full shared DataRoom data (including files and folder tree).
 */
async function getSharedDataRoom(req, res, next) {
  try {
    // Verify access
    const access = await SharedDataRoomAccess.findOne({
      sharedDataRoomId: req.params.shareId,
      userId: req.user.userId,
      status: 'active',
    });
    if (!access) return res.status(403).json({ error: 'Access denied' });

    const shared = await SharedDataRoom.findOne({
      _id: req.params.shareId,
      isDeleted: false,
    });
    if (!shared) return res.status(404).json({ error: 'Not found' });

    // Update last viewed version
    access.lastViewedVersion = shared.snapshotVersion;
    await access.save();

    res.json({ sharedDataRoom: shared });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/sharing/users/search?q=...
 * Search users for sharing.
 * - Individual users: exact email match only
 * - Enterprise users: can search within org by name or email
 */
async function searchUsers(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) return res.json({ users: [] });

    const currentUser = await User.findById(req.user.userId);
    let users = [];

    if (currentUser.activeOrganizationId) {
      // Enterprise: search within organization
      const members = await OrganizationMember.find({
        organizationId: currentUser.activeOrganizationId,
        status: 'active',
        userId: { $ne: req.user.userId },
      }).populate('userId', 'name email profilePicture');

      users = members
        .filter(m => {
          const u = m.userId;
          return u.name.toLowerCase().includes(q.toLowerCase()) ||
                 u.email.toLowerCase().includes(q.toLowerCase());
        })
        .map(m => ({
          _id: m.userId._id,
          name: m.userId.name,
          email: m.userId.email,
          profilePicture: m.userId.profilePicture,
          isOrgMember: true,
        }));
    }

    // Also search by exact email for cross-org or individual sharing
    if (q.includes('@')) {
      const exactMatch = await User.findOne({
        email: q.toLowerCase(),
        isDeleted: false,
        _id: { $ne: req.user.userId },
      }).select('name email profilePicture');

      if (exactMatch && !users.find(u => u._id.toString() === exactMatch._id.toString())) {
        users.push({
          _id: exactMatch._id,
          name: exactMatch.name,
          email: exactMatch.email,
          profilePicture: exactMatch.profilePicture,
          isOrgMember: false,
        });
      }
    }

    res.json({ users });
  } catch (error) {
    next(error);
  }
}

function countFolders(folderTree) {
  if (!folderTree || !Array.isArray(folderTree)) return 0;
  return folderTree.reduce((count, folder) => {
    return count + 1 + countFolders(folder.children);
  }, 0);
}

// Export all functions
module.exports = {
  createSharedDataRoom,
  updateSharedDataRoom,
  deleteSharedDataRoom: async (req, res, next) => { /* soft delete */ },
  grantAccess,
  revokeAccess: async (req, res, next) => { /* set status: 'revoked' */ },
  listAccess: async (req, res, next) => { /* list accesses for a share */ },
  listMyShares: async (req, res, next) => { /* list shares owned by user */ },
  listReceived,
  getSharedDataRoom,
  searchUsers,
};
```

### 5.4 Register Sharing Routes

**File**: `express-backend/src/server.js`

```javascript
const sharingRoutes = require('./routes/sharing');
app.use('/api/v1/sharing', sharingRoutes);
```

### 5.5 Python: DataRoom Export Endpoint

**File**: `python-backend/app/main.py`

Add a new endpoint to export a DataRoom as a JSON snapshot:

```python
@app.post("/api/v1/sharing/export-dataroom")
async def export_dataroom(request: dict):
    """Export DataRoom data as a snapshot for sharing.
    Returns folder tree, file metadata, FULL extracted text, classifications, entities, summaries.
    Does NOT include original_path (local to this machine).

    IMPORTANT: files.extracted_text is truncated to 3000 chars at registration time.
    For the FULL text, we must read from file_chunks (created during indexing).
    file_chunks stores the complete extracted text split into overlapping chunks.
    We concatenate chunks (removing overlaps) to reconstruct full text for sharing.
    """
    dataroom_id = request.get("dataroom_id")

    with get_session() as session:
        dataroom = session.query(DataRoom).filter_by(id=dataroom_id).first()
        if not dataroom:
            raise HTTPException(status_code=404, detail="DataRoom not found")

        # Build folder tree
        folders = session.query(Folder).filter_by(dataroom_id=dataroom_id).all()
        folder_tree = build_nested_folder_tree(folders)

        # Get files with classifications and entities
        files = session.query(File).filter_by(dataroom_id=dataroom_id).all()
        file_data = []
        for f in files:
            classification = session.query(Classification).filter_by(file_id=f.id).first()
            entities = session.query(FileEntity).filter_by(file_id=f.id).all()

            # Get FULL text from file_chunks if the file has been indexed
            # file_chunks contains the complete extracted text (not truncated)
            chunks = session.execute(
                text("SELECT chunk_text FROM file_chunks WHERE file_id = :fid ORDER BY chunk_index ASC"),
                {"fid": f.id}
            ).fetchall()

            if chunks:
                # Reconstruct full text from chunks (chunks have overlap, so deduplicate)
                full_text = _reconstruct_text_from_chunks(
                    [c[0] for c in chunks],
                    overlap_chars=int(os.getenv("RAG_CHUNK_OVERLAP_CHARS", "750"))
                )
            else:
                # Fallback: use truncated extracted_text (3000 chars) for unindexed files
                full_text = f.extracted_text or ""

            file_data.append({
                "id": f.id,
                "original_name": f.original_name,
                "file_extension": f.file_extension,
                "size_bytes": f.size_bytes,
                "extracted_text": full_text,  # Full text from chunks, or truncated fallback
                "extracted_text_length": len(full_text),
                "is_fully_indexed": len(chunks) > 0,
                "ai_summary": f.ai_summary,
                "folder_id": f.folder_id,
                "classification_confidence": classification.confidence if classification else None,
                "classification_reasoning": classification.reasoning if classification else None,
                "entities": [
                    {"type": e.entity_type, "value": e.entity_value, "context": e.context}
                    for e in entities
                ],
            })

        return {
            "dataroom": {
                "id": dataroom.id,
                "name": dataroom.name,
                "description": dataroom.description,
            },
            "folderTree": folder_tree,
            "files": file_data,
        }


def _reconstruct_text_from_chunks(chunk_texts: list, overlap_chars: int = 750) -> str:
    """Reconstruct full text from overlapping chunks.
    Chunks are created with overlap (default 750 chars). When reconstructing,
    skip the overlap portion of each subsequent chunk to avoid duplication.
    """
    if not chunk_texts:
        return ""
    if len(chunk_texts) == 1:
        return chunk_texts[0]

    result = chunk_texts[0]
    for i in range(1, len(chunk_texts)):
        chunk = chunk_texts[i]
        # Skip the overlap portion (first N chars of this chunk overlap with end of previous)
        # Use a safe overlap size (don't skip more than the chunk itself)
        skip = min(overlap_chars, len(chunk) // 2)
        result += chunk[skip:]
    return result


def build_nested_folder_tree(folders, parent_id=None):
    """Build nested folder structure from flat list."""
    tree = []
    for f in folders:
        if f.parent_id == parent_id:
            tree.append({
                "id": f.id,
                "name": f.name,
                "context": f.context,
                "children": build_nested_folder_tree(folders, f.id),
            })
    return tree
```

**Warning to the user before sharing**: If files have not been indexed yet, only the first 3000 characters of extracted text will be shared. The share dialog should show a warning like:
> "X of Y files have not been indexed. Only partial text (3000 chars) will be shared for unindexed files. Index all files first for complete sharing."

### 5.6 Python: DataRoom Import Endpoint

```python
@app.post("/api/v1/sharing/import-dataroom")
async def import_dataroom(request: dict):
    """Import a shared DataRoom snapshot into local SQLite.
    Creates a read-only DataRoom with shared files.
    """
    snapshot = request.get("snapshot")

    with get_session() as session:
        # Create DataRoom marked as shared
        dataroom = DataRoom(
            id=str(uuid.uuid4()),
            name=f"[Shared] {snapshot['sourceDataroomName']}",
            description=snapshot.get('sourceDataroomDescription', ''),
            is_shared=True,
            shared_from_user_name=snapshot.get('ownerName', 'Unknown'),
            shared_dataroom_cloud_id=snapshot.get('_id', ''),
            shared_snapshot_version=snapshot.get('snapshotVersion', 1),
        )
        session.add(dataroom)

        # Create folders (map old IDs to new IDs)
        folder_id_map = {}
        create_folders_recursive(session, dataroom.id, snapshot['folderTree'], None, folder_id_map)

        # Create file records
        for f in snapshot.get('files', []):
            new_folder_id = folder_id_map.get(f.get('folder_id'))
            file_record = File(
                id=str(uuid.uuid4()),
                dataroom_id=dataroom.id,
                folder_id=new_folder_id,
                original_name=f['original_name'],
                original_path='SHARED',  # Not a real path
                file_extension=f.get('file_extension', ''),
                size_bytes=f.get('size_bytes', 0),
                extracted_text=f.get('extracted_text', ''),
                ai_summary=f.get('ai_summary', ''),
                status='classified' if new_folder_id else 'registered',
                is_shared=True,
            )
            session.add(file_record)

            # Create classification if exists
            if f.get('classification_confidence') is not None:
                classification = Classification(
                    id=str(uuid.uuid4()),
                    file_id=file_record.id,
                    folder_id=new_folder_id,
                    confidence=f['classification_confidence'],
                    reasoning=f.get('classification_reasoning', ''),
                )
                session.add(classification)

            # Create entities
            for entity in f.get('entities', []):
                session.add(FileEntity(
                    id=str(uuid.uuid4()),
                    file_id=file_record.id,
                    dataroom_id=dataroom.id,
                    entity_type=entity['type'],
                    entity_value=entity['value'],
                    context=entity.get('context', ''),
                ))

        session.commit()

        return {"dataroom_id": dataroom.id, "message": "Shared DataRoom imported successfully"}


def create_folders_recursive(session, dataroom_id, folder_tree, parent_id, id_map):
    """Recursively create folders from tree structure, mapping old to new IDs."""
    for folder in folder_tree:
        new_id = str(uuid.uuid4())
        id_map[folder['id']] = new_id
        session.add(Folder(
            id=new_id,
            dataroom_id=dataroom_id,
            name=folder['name'],
            context=folder.get('context', ''),
            parent_id=parent_id,
        ))
        if folder.get('children'):
            create_folders_recursive(session, dataroom_id, folder['children'], new_id, id_map)
```

### 5.7 Python: SQLite Schema Changes

**File**: `python-backend/app/main.py`

Add columns to DataRoom model:
```python
is_shared = Column(Boolean, default=False)
shared_from_user_name = Column(String, nullable=True)
shared_dataroom_cloud_id = Column(String, nullable=True)
shared_snapshot_version = Column(Integer, nullable=True)
```

Add column to File model:
```python
is_shared = Column(Boolean, default=False)
```

Add migration logic in `/init-db`:
```python
# After existing migration checks
inspector = inspect(engine)
if 'datarooms' in inspector.get_table_names():
    columns = [c['name'] for c in inspector.get_columns('datarooms')]
    if 'is_shared' not in columns:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE datarooms ADD COLUMN is_shared BOOLEAN DEFAULT 0"))
            conn.execute(text("ALTER TABLE datarooms ADD COLUMN shared_from_user_name TEXT"))
            conn.execute(text("ALTER TABLE datarooms ADD COLUMN shared_dataroom_cloud_id TEXT"))
            conn.execute(text("ALTER TABLE datarooms ADD COLUMN shared_snapshot_version INTEGER"))
            conn.commit()

if 'files' in inspector.get_table_names():
    columns = [c['name'] for c in inspector.get_columns('files')]
    if 'is_shared' not in columns:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE files ADD COLUMN is_shared BOOLEAN DEFAULT 0"))
            conn.commit()
```

### 5.8 Electron: Sharing IPC Handlers

**New file**: `electron/ipc/sharingHandlers.js`

```javascript
const { ipcMain } = require('electron');
const authService = require('../services/authService');
const pythonService = require('../services/pythonService');
const log = require('../services/logger');

function registerSharingHandlers() {
  // Share a DataRoom with a user
  ipcMain.handle('sharing:shareDataroom', async (event, { dataroomId, recipientEmail }) => {
    try {
      // Step 1: Export snapshot from Python
      const snapshot = await pythonService.request('POST', '/api/v1/sharing/export-dataroom', {
        dataroom_id: dataroomId,
      });

      // Step 2: Send snapshot to Express
      const token = authService.getToken();
      const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/sharing/datarooms`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDataroomId: dataroomId,
          name: snapshot.dataroom.name,
          description: snapshot.dataroom.description,
          folderTree: snapshot.folderTree,
          files: snapshot.files,
          recipientEmail,
        }),
      });

      return await res.json();
    } catch (error) {
      log.error('Share DataRoom failed:', error);
      return { error: error.message };
    }
  });

  // List DataRooms shared with me
  ipcMain.handle('sharing:getReceived', async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/sharing/received`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (error) {
      return { received: [] };
    }
  });

  // Import shared DataRoom into local SQLite
  ipcMain.handle('sharing:importDataroom', async (event, { shareId }) => {
    try {
      // Step 1: Get full snapshot from Express
      const token = authService.getToken();
      const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/sharing/received/${shareId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const { sharedDataRoom } = await res.json();

      // Step 2: Import into local SQLite via Python
      const result = await pythonService.request('POST', '/api/v1/sharing/import-dataroom', {
        snapshot: sharedDataRoom,
      });

      return result;
    } catch (error) {
      log.error('Import shared DataRoom failed:', error);
      return { error: error.message };
    }
  });

  // Search users for sharing
  ipcMain.handle('sharing:searchUsers', async (event, { query }) => {
    try {
      const token = authService.getToken();
      const res = await fetch(
        `${process.env.EXPRESS_URL}/api/v1/sharing/users/search?q=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      return await res.json();
    } catch (error) {
      return { users: [] };
    }
  });

  // Update shared DataRoom (re-share with latest data)
  ipcMain.handle('sharing:updateShare', async (event, { shareId, dataroomId }) => {
    try {
      // Re-export from Python
      const snapshot = await pythonService.request('POST', '/api/v1/sharing/export-dataroom', {
        dataroom_id: dataroomId,
      });

      // Update on Express
      const token = authService.getToken();
      const res = await fetch(`${process.env.EXPRESS_URL}/api/v1/sharing/datarooms/${shareId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderTree: snapshot.folderTree,
          files: snapshot.files,
        }),
      });

      return await res.json();
    } catch (error) {
      return { error: error.message };
    }
  });
}

module.exports = { registerSharingHandlers };
```

### 5.9 Preload + Frontend

**File**: `electron/preload.js`

```javascript
sharing: {
  shareDataroom: (payload) => ipcRenderer.invoke('sharing:shareDataroom', payload),
  getReceived: () => ipcRenderer.invoke('sharing:getReceived'),
  importDataroom: (shareId) => ipcRenderer.invoke('sharing:importDataroom', { shareId }),
  searchUsers: (query) => ipcRenderer.invoke('sharing:searchUsers', { query }),
  updateShare: (payload) => ipcRenderer.invoke('sharing:updateShare', payload),
},
```

**New Redux slice**: `frontend/src/store/sharingSlice.js`

```javascript
const initialState = {
  received: [],            // DataRooms shared with me
  myShares: [],            // DataRooms I shared
  searchResults: [],       // User search results
  isLoading: false,
  isSharing: false,
  isImporting: false,
  error: null,
};

// Thunks: fetchReceived, shareDataroom, importDataroom, searchUsers, updateShare
```

**New components:**
- `frontend/src/components/sharing/ShareDialog.jsx` -- User search + share button
- `frontend/src/components/sharing/SharedWithMe.jsx` -- List received DataRooms with "Import" button
- Add "Share" button to DataRoom header/context menu

### 5.10 Collaboration Page + Sidebar Navigation

The collaboration feature gets its own **dedicated sidebar item and page** — it is NOT embedded inside the DataRoom page.

**Step 1: Add icon to Sidebar** (`frontend/src/components/layout/Sidebar.jsx`)

Add a new icon component at the top of the file alongside existing icons:

```javascript
const IconCollaboration = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {/* Two people / sharing icon */}
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
```

Add the NavItem to `topNav` section (between Upload and the bottom divider):

```javascript
<NavItem
  icon={<IconCollaboration />}
  label="Collaboration"
  collapsed={collapsed}
  active={activePage === 'collaboration'}
  onClick={() => dispatch(setActivePage('collaboration'))}
/>
```

**Step 2: Create the page** (`frontend/src/pages/CollaborationPage.jsx`)

```javascript
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import SharedWithMe from '../components/sharing/SharedWithMe';
import MyShares from '../components/sharing/MyShares';
import './CollaborationPage.css';

function CollaborationPage() {
  const dispatch = useDispatch();
  const { received, myShares, isLoading } = useSelector(state => state.sharing);
  const [activeTab, setActiveTab] = useState('received'); // 'received' | 'shared'

  useEffect(() => {
    dispatch(fetchReceived());
    dispatch(fetchMyShares());
  }, [dispatch]);

  return (
    <div className="collaboration-page">
      <div className="collaboration-header">
        <h1>Collaboration</h1>
        <p className="collaboration-subtitle">DataRooms shared with you and by you</p>
      </div>

      <div className="collaboration-tabs">
        <button
          className={`tab ${activeTab === 'received' ? 'active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          Shared with me {received.length > 0 && <span className="badge">{received.length}</span>}
        </button>
        <button
          className={`tab ${activeTab === 'shared' ? 'active' : ''}`}
          onClick={() => setActiveTab('shared')}
        >
          My shares {myShares.length > 0 && <span className="badge">{myShares.length}</span>}
        </button>
      </div>

      <div className="collaboration-content">
        {activeTab === 'received' && <SharedWithMe items={received} isLoading={isLoading} />}
        {activeTab === 'shared' && <MyShares items={myShares} isLoading={isLoading} />}
      </div>
    </div>
  );
}

export default CollaborationPage;
```

**Step 3: Register in App.jsx** (`frontend/src/App.jsx`)

```javascript
import CollaborationPage from './pages/CollaborationPage';

// In the render section, alongside existing pages:
{activePage === 'collaboration' && <CollaborationPage />}
```

**Step 4: Update uiSlice.js** — No changes needed, `setActivePage` already accepts any string.

**Step 5: New components for the Collaboration page**

`frontend/src/components/sharing/SharedWithMe.jsx`:
- Grid/list of DataRooms shared with the user
- Each card shows: DataRoom name, sharer name, file count, shared date, snapshot version
- Actions: "View" (read-only explorer), "Import" (into local SQLite), "New version available" badge
- Empty state: "No DataRooms have been shared with you yet"

`frontend/src/components/sharing/MyShares.jsx`:
- Grid/list of DataRooms the user has shared
- Each card shows: DataRoom name, recipient(s), last updated, snapshot version
- Actions: "Update" (re-push latest snapshot), "Manage access" (add/remove recipients), "Revoke"
- Empty state: "You haven't shared any DataRooms yet"

`frontend/src/components/sharing/ShareDialog.jsx`:
- Modal triggered from DataRoom context menu → "Share"
- User search input (email for individuals, name/email for org members)
- Permission selector: Viewer (default)
- "Share" button → calls `window.api.sharing.shareDataroom()`
- Shows warning if unindexed files exist: "X files have partial text — index first for best results"

**Step 6: Page-specific styles** (`frontend/src/pages/CollaborationPage.css`)
- Follow the same layout pattern as DataRoomList page
- Use design system tokens from `design-system/Orvyn/MASTER.md`

**Nav order in sidebar** (top to bottom):
1. DataRoom (existing)
2. Upload (existing)
3. **Collaboration** (new)
4. ---divider---
5. Settings (existing)

### 5.11 Shared DataRoom UI Behavior

Shared DataRooms imported into local SQLite should:
- Display with a "Shared" badge and the sharer's name
- NOT show "Open File" actions (files are not local)
- Show all metadata, classifications, summaries, entities
- Allow Copilot chat (after local embedding re-generation from shared full text)
- NOT allow file operations (add, move, delete, rename)
- Show "New version available" when `snapshotVersion` increments
- Allow re-import to update with latest snapshot

---

## Phase 6: Audit Logs (Enterprise)

**Goal**: Track all significant user actions for enterprise compliance and transparency.

**Dependencies**: Phase 3 (Organizations). Should be implemented alongside or after collaboration.

### 6.1 Why Audit Logs Are Essential for Enterprise

Enterprises expect full visibility into:
- Who shared what DataRoom with whom, and when
- Who accessed shared DataRooms
- Who invited/removed members
- Payment events (upgrades, downgrades, failures)
- DataRoom creation/deletion

Without audit logs, enterprise customers will not trust the platform for sensitive document management.

### 6.2 AuditLog MongoDB Model

**New file**: `express-backend/src/models/AuditLog.js`

```javascript
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userName: { type: String, required: true }, // Denormalized for fast reads
  userEmail: { type: String, required: true },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Sharing
      'dataroom.shared',
      'dataroom.share_revoked',
      'dataroom.share_updated',
      'dataroom.accessed',        // Recipient viewed shared DataRoom
      'dataroom.imported',        // Recipient imported shared DataRoom

      // Organization
      'org.member_invited',
      'org.member_joined',
      'org.member_removed',
      'org.member_role_changed',
      'org.settings_updated',

      // Billing
      'billing.subscription_created',
      'billing.payment_success',
      'billing.payment_failed',
      'billing.subscription_cancelled',
      'billing.plan_downgraded',

      // DataRoom lifecycle
      'dataroom.created',
      'dataroom.deleted',
    ],
    index: true,
  },
  resourceType: {
    type: String,
    enum: ['dataroom', 'organization', 'subscription', 'user'],
    required: true,
  },
  resourceId: { type: String, required: true }, // ID of the affected resource
  resourceName: { type: String, default: null }, // Human-readable (e.g., DataRoom name)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // E.g., { recipientEmail, permission, paymentId, oldRole, newRole }
  ipAddress: { type: String, default: null },
}, {
  timestamps: true, // createdAt serves as the event timestamp
});

// Compound index for org-level audit queries
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
// User-level audit queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
// TTL index: auto-delete logs older than 1 year (configurable)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
```

### 6.3 Audit Logger Utility

**New file**: `express-backend/src/services/auditService.js`

```javascript
const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * Log an auditable action. Call this from controllers/services after the action succeeds.
 *
 * @param {Object} params
 * @param {string} params.userId - Who performed the action
 * @param {string} params.userName
 * @param {string} params.userEmail
 * @param {string} [params.organizationId] - Org context (if applicable)
 * @param {string} params.action - Action enum value
 * @param {string} params.resourceType - 'dataroom' | 'organization' | 'subscription' | 'user'
 * @param {string} params.resourceId - ID of the affected resource
 * @param {string} [params.resourceName] - Human-readable name
 * @param {Object} [params.metadata] - Extra context (recipientEmail, paymentId, etc.)
 * @param {string} [params.ipAddress]
 */
async function logAudit(params) {
  try {
    await AuditLog.create(params);
  } catch (err) {
    // Audit logging should never block the main operation
    logger.error('Failed to write audit log:', err.message);
  }
}

module.exports = { logAudit };
```

### 6.4 Where to Add Audit Calls

Add `logAudit()` calls in these locations:

| Location | Action | Metadata |
|----------|--------|----------|
| `sharingController.createSharedDataRoom` | `dataroom.shared` | `{ recipientEmail, permission }` |
| `sharingController.revokeAccess` | `dataroom.share_revoked` | `{ revokedUserId }` |
| `sharingController.updateSharedDataRoom` | `dataroom.share_updated` | `{ snapshotVersion }` |
| `sharingController.getSharedDataRoom` | `dataroom.accessed` | — |
| Electron `sharing:importDataroom` via Express | `dataroom.imported` | `{ shareId }` |
| `organizationController.createInvite` | `org.member_invited` | `{ invitedEmail, role }` |
| `organizationController.acceptInvite` | `org.member_joined` | `{ inviteCode }` |
| `organizationController.removeMember` | `org.member_removed` | `{ removedUserId }` |
| `organizationController.updateMemberRole` | `org.member_role_changed` | `{ targetUserId, oldRole, newRole }` |
| `razorpayService.handleWebhookEvent` (`subscription.charged`) | `billing.payment_success` | `{ paymentId, amount }` |
| `razorpayService.handleWebhookEvent` (`payment.failed`) | `billing.payment_failed` | `{ paymentId, reason }` |
| `razorpayService.handleWebhookEvent` (`subscription.cancelled`) | `billing.subscription_cancelled` | — |
| DataRoom creation (Express or via IPC report) | `dataroom.created` | `{ dataroomName }` |
| DataRoom deletion (Express or via IPC report) | `dataroom.deleted` | `{ dataroomName }` |

**Example** (in `sharingController.createSharedDataRoom`, after successful creation):
```javascript
const { logAudit } = require('../services/auditService');

// After shared DataRoom is created + access granted:
await logAudit({
  userId: req.user.userId,
  userName: user.name,
  userEmail: user.email,
  organizationId: user.activeOrganizationId || null,
  action: 'dataroom.shared',
  resourceType: 'dataroom',
  resourceId: shared._id.toString(),
  resourceName: name,
  metadata: { recipientEmail, permission: 'viewer' },
  ipAddress: req.ip,
});
```

### 6.5 Audit Log Endpoints

**Add to** `express-backend/src/routes/organization.js` (org-level logs) and a new admin route:

```javascript
// GET /api/v1/organizations/:orgId/audit-logs
// Query params: ?action=dataroom.shared&page=1&limit=50&from=2026-01-01&to=2026-03-31
router.get('/:orgId/audit-logs', authenticate, orgAuthorize('admin', 'owner'), async (req, res, next) => {
  try {
    const { action, page = 1, limit = 50, from, to } = req.query;
    const query = { organizationId: req.params.orgId };

    if (action) query.action = action;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await AuditLog.countDocuments(query);

    res.json({ logs, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/users/me/audit-logs — individual user's own activity
router.get('/me/audit-logs', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const logs = await AuditLog.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await AuditLog.countDocuments({ userId: req.user.userId });
    res.json({ logs, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});
```

### 6.6 Electron IPC + Frontend

**Electron** (`ipc/organizationHandlers.js` — add to existing):
```javascript
ipcMain.handle('organization:getAuditLogs', async (event, { orgId, filters }) => {
  const token = authService.getToken();
  const params = new URLSearchParams(filters).toString();
  const res = await fetch(
    `${process.env.EXPRESS_URL}/api/v1/organizations/${orgId}/audit-logs?${params}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return await res.json();
});
```

**Preload** — add to `organization` namespace:
```javascript
getAuditLogs: (orgId, filters) => ipcRenderer.invoke('organization:getAuditLogs', { orgId, filters }),
```

**Frontend**: Add an "Activity Log" tab to `OrganizationSettings.jsx` showing a filterable, paginated table of audit events. Only visible to `admin` and `owner` roles.

---

## Summary: All New Files

### Express Backend
| File | Purpose |
|------|---------|
| `services/googleAuthService.js` | Google OAuth token exchange + user creation |
| `controllers/googleAuthController.js` | Google auth endpoints |
| `models/Organization.js` | Organization entity |
| `models/OrganizationMember.js` | User-org membership |
| `models/OrganizationInvite.js` | Pending invitations |
| `models/Subscription.js` | Razorpay billing state |
| `models/SharedDataRoom.js` | Shared DataRoom snapshots |
| `models/SharedDataRoomAccess.js` | Per-user access grants |
| `models/AuditLog.js` | Enterprise audit trail |
| `controllers/organizationController.js` | Org CRUD logic |
| `controllers/sharingController.js` | Sharing logic |
| `services/razorpayService.js` | Razorpay SDK integration |
| `services/emailService.js` | V2 email templates (invites, payments, sharing) |
| `services/auditService.js` | Audit logging utility |
| `routes/organization.js` | Org API routes |
| `routes/billing.js` | Billing API routes + web checkout pages |
| `routes/sharing.js` | Sharing API routes |
| `middleware/orgAuthorize.js` | Organization role middleware |
| `middleware/enforceLimits.js` | Server-side usage enforcement (message, file, dataroom limits) |
| `config/planLimits.js` | Plan-to-limits mapping |
| `views/checkout.ejs` | Razorpay checkout web page |
| `views/payment-success.ejs` | Post-payment success page |
| `views/payment-failure.ejs` | Post-payment failure page |
| `public/css/checkout.css` | Checkout page styles |

### Electron
| File | Purpose |
|------|---------|
| `ipc/organizationHandlers.js` | Org IPC handlers |
| `ipc/billingHandlers.js` | Billing IPC handlers |
| `ipc/sharingHandlers.js` | Sharing IPC handlers |

### Frontend
| File | Purpose |
|------|---------|
| `store/organizationSlice.js` | Org state |
| `store/billingSlice.js` | Billing state |
| `store/sharingSlice.js` | Sharing state |
| `components/auth/UserTypeSelection.jsx` | Post-auth type picker |
| `components/auth/CreateOrganization.jsx` | Org creation |
| `components/auth/JoinOrganization.jsx` | Accept invite |
| `pages/OrganizationSettings.jsx` | Org management |
| `pages/CollaborationPage.jsx` | Shared DataRooms hub (received + sent) |
| `pages/CollaborationPage.css` | Collaboration page styles |
| `components/settings/BillingSettings.jsx` | Billing UI |
| `components/sharing/ShareDialog.jsx` | Share DataRoom modal |
| `components/sharing/SharedWithMe.jsx` | Received DataRooms grid |
| `components/sharing/MyShares.jsx` | Sent DataRooms grid |

### Modified Files
| File | Changes |
|------|---------|
| `express-backend/src/models/User.js` | Add googleId, profilePicture, userType, activeOrganizationId |
| `express-backend/src/models/UserLimits.js` | Add dataroomLimit, plan |
| `express-backend/src/routes/auth.js` | Add /google, /google/link, /set-user-type |
| `express-backend/src/services/authService.js` | Google edge case guards (register, login, forgotPassword) |
| `express-backend/src/middleware/rateLimiter.js` | Add googleLoginLimiter |
| `express-backend/src/routes/ai.js` | Apply enforceLimits middleware to chat, classify, generate endpoints |
| `express-backend/src/models/UserUsage.js` | Add lastDailyReset, lastMonthlyReset fields |
| `express-backend/src/server.js` | Register new route files, add EJS view engine + static serving |
| `electron/main.js` | Register `orvyn://` protocol for deep links (invites) |
| `electron/services/authService.js` | Google auth methods, loopback server |
| `electron/ipc/authHandlers.js` | Google auth IPC, subscription check, DataRoom limit check |
| `electron/preload.js` | New namespaces: organization, billing, sharing, usage, deepLink |
| `python-backend/app/main.py` | New columns (is_shared etc.), export/import endpoints with full-text chunk reconstruction |
| `frontend/src/components/layout/Sidebar.jsx` | Add Collaboration icon + nav item |
| `frontend/src/App.jsx` | Add CollaborationPage conditional render |
| `frontend/src/components/auth/Login.jsx` | Google sign-in button + Google-only account UX |
| `frontend/src/components/auth/Register.jsx` | Google sign-up button |
| `frontend/src/store/authSlice.js` | Plan, limits, usage in state |

### New Dependencies
| Package | Layer | Purpose |
|---------|-------|---------|
| `google-auth-library` | Express | Google OAuth token verification |
| `razorpay` | Express | Razorpay payment SDK |
| `ejs` | Express | Template engine for checkout web pages |

### New Environment Variables
| Variable | Layer | Purpose |
|----------|-------|---------|
| `GOOGLE_CLIENT_ID` | Express + Electron | Google OAuth client ID (public) |
| `GOOGLE_CLIENT_SECRET` | Express only | Google OAuth client secret |
| `RAZORPAY_KEY_ID` | Express | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Express | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | Express | Webhook signature verification |
| `RAZORPAY_PLAN_ID_PRO` | Express | Razorpay plan ID for individual pro |
| `RAZORPAY_PLAN_ID_ENTERPRISE` | Express | Razorpay plan ID for enterprise |

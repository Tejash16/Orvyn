const authService            = require('../services/authService');
const userContextService     = require('../services/userContextService');
const pythonService          = require('../services/pythonService');
const expressService         = require('../services/expressService');
const tokenVault             = require('../services/tokenVault');
const tokenRefreshScheduler  = require('../services/tokenRefreshScheduler');
const { resumePendingIndexing } = require('./copilotHandlers');
const notificationStream        = require('./notificationHandlers');
const log = require('../services/logger');

/**
 * Registers all auth IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 *   Getter for the main window — used to push session-expiry and
 *   online-status events to the renderer without a request/response cycle.
 */
function registerAuthHandlers(ipcMain, getMainWindow) {

  // ── Helpers ───────────────────────────────────────────────

  /** Sends auth:sessionExpired to the renderer (forced logout). */
  function notifySessionExpired() {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send('auth:sessionExpired');
  }

  /** Sends app:offlineStatus to the renderer when connectivity changes. */
  function notifyOffline(isOnline) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send('app:offlineStatus', isOnline);
  }

  /**
   * Starts the background refresh timer for a newly established session.
   * onFailed  → pushes sessionExpired to renderer
   * onOffline → pushes offlineStatus to renderer
   */
  function startRefreshScheduler() {
    tokenRefreshScheduler.schedule(
      authService.getToken(),
      notifySessionExpired,
      notifyOffline
    );
  }

  /** Full rollback of all in-memory + vault state. */
  function rollback() {
    tokenRefreshScheduler.cancel();
    stopSubscriptionCheck();
    notificationStream.stopStream();
    tokenVault.remove();
    authService.logout();
    userContextService.clear();
  }

  // ── Periodic subscription status check ───────────────────

  let subscriptionCheckInterval = null;

  /** Start polling subscription status every 30 minutes. */
  function startSubscriptionCheck() {
    if (subscriptionCheckInterval) clearInterval(subscriptionCheckInterval);
    subscriptionCheckInterval = setInterval(async () => {
      try {
        const token = authService.getToken();
        if (!token) return;
        const res = await fetch(`${expressService.getExpressUrl()}/api/v1/billing/status`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) return;
        const status = await res.json();
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('billing:statusUpdate', status);
        }
      } catch { /* ignore network errors */ }
    }, 30 * 60 * 1000); // 30 minutes
  }

  /** Stop the subscription check interval. */
  function stopSubscriptionCheck() {
    if (subscriptionCheckInterval) {
      clearInterval(subscriptionCheckInterval);
      subscriptionCheckInterval = null;
    }
  }

  // ── Register ─────────────────────────────────────────────

  ipcMain.handle('auth:register', async (_event, { name, email, password }) => {
    try {
      const result = await authService.register({ name, email, password });
      return {
        success:         true,
        message:         result.message,
        cooldownSeconds: result.cooldownSeconds,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Login ─────────────────────────────────────────────────
  //
  // Step 1: Express auth       — access token (memory) + refresh token returned
  // Step 2: Directory init     — user data dir + database path computed
  // Step 3: Python /init-db    — SQLite created + schema applied
  // Step 4: Theme fetch        — stored theme retrieved from SQLite
  // Step 5: Vault write        — refresh token encrypted to disk (best-effort)
  // Step 6: Scheduler start    — background refresh scheduled
  //
  // Any step 2-4 failure → full rollback.

  ipcMain.handle('auth:login', async (_event, { email, password }) => {
    try {
      // Step 1
      const { user, refreshToken } = await authService.login({ email, password });

      // Step 2
      await userContextService.initializeUserDirectory(String(user._id));
      const databasePath = userContextService.getActiveDatabasePath();

      // Step 3
      try {
        await pythonService.initDb(databasePath, String(user._id));
      } catch (err) {
        authService.logout();
        userContextService.clear();
        throw new Error(`Database initialisation failed: ${err.message}`);
      }

      // Step 4
      let theme;
      try {
        theme = await pythonService.getTheme();
      } catch (err) {
        authService.logout();
        userContextService.clear();
        throw new Error(`Theme fetch failed: ${err.message}`);
      }

      // Step 5 — best-effort; vault failure does not break the session
      try {
        tokenVault.store(refreshToken);
      } catch { /* non-fatal */ }

      // Step 6
      startRefreshScheduler();

      // Step 7 — start periodic subscription check
      startSubscriptionCheck();

      // Step 8 — open the real-time notifications stream
      notificationStream.startStream(getMainWindow);

      // Step 9 — resume any pending indexing jobs (fire-and-forget)
      resumePendingIndexing(getMainWindow)
        .catch(() => { /* non-fatal */ });

      return { success: true, user, theme };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Session Restore ───────────────────────────────────────
  //
  // Step 1: Python health check
  // Step 2: Read refresh token from vault
  // Step 3: Exchange refresh token → new access + refresh tokens (validates + rotates)
  // Step 4: Restore in-memory session
  // Step 5: Init user directory
  // Step 6: Python /init-db
  // Step 7: Fetch theme
  // Step 8: Update vault with rotated refresh token
  // Step 9: Start background scheduler

  ipcMain.handle('auth:restoreSession', async () => {
    try {
      // Step 1 — Wait for Python to become healthy.
      // pythonProcess.start() runs just before the window opens, so the
      // FastAPI server may still be booting when React mounts and calls
      // restoreSession.  Poll up to ~10 s (20 × 500 ms) before giving up.
      const MAX_HEALTH_ATTEMPTS = 20;
      const HEALTH_INTERVAL_MS  = 500;
      let pythonReady = false;

      for (let i = 0; i < MAX_HEALTH_ATTEMPTS; i++) {
        try {
          await pythonService.checkHealth();
          pythonReady = true;
          break;
        } catch {
          await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
        }
      }

      if (!pythonReady) return { success: false };

      // Step 2
      const storedRefreshToken = tokenVault.read();
      if (!storedRefreshToken) return { success: false };

      // Step 3 — Exchange: validates token and rotates it in one operation
      let tokens;
      try {
        tokens = await authService.refreshTokens(storedRefreshToken);
      } catch {
        // Token expired or revoked — require fresh login
        tokenVault.remove();
        return { success: false };
      }

      const { user, refreshToken: newRefreshToken } = tokens;

      // Step 4
      authService.setSession(authService.getToken(), user);

      // Step 5
      await userContextService.initializeUserDirectory(String(user._id));
      const databasePath = userContextService.getActiveDatabasePath();

      // Step 6
      try {
        await pythonService.initDb(databasePath, String(user._id));
      } catch {
        rollback();
        return { success: false };
      }

      // Step 7
      let theme;
      try {
        theme = await pythonService.getTheme();
      } catch {
        rollback();
        return { success: false };
      }

      // Step 8 — persist the rotated refresh token
      try {
        tokenVault.store(newRefreshToken);
      } catch { /* non-fatal */ }

      // Step 9
      startRefreshScheduler();

      // Step 10 — start periodic subscription check
      startSubscriptionCheck();

      // Step 11 — open the real-time notifications stream
      notificationStream.startStream(getMainWindow);

      // Step 12 — resume any pending indexing jobs (fire-and-forget)
      resumePendingIndexing(getMainWindow)
        .catch(() => { /* non-fatal */ });

      return { success: true, user, theme };
    } catch {
      rollback();
      return { success: false };
    }
  });

  // ── Logout ────────────────────────────────────────────────

  ipcMain.handle('auth:logout', async () => {
    try {
      // Cancel the refresh timer before clearing state
      tokenRefreshScheduler.cancel();
      stopSubscriptionCheck();
      notificationStream.stopStream();

      // Best-effort server-side revocation of the refresh token
      const storedRefreshToken = tokenVault.read();
      if (storedRefreshToken) {
        await authService.revokeRefreshToken(storedRefreshToken);
      }

      // Clear vault, in-memory state, and user context
      tokenVault.remove();
      authService.logout();
      userContextService.clear();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Delete Account ────────────────────────────────────────
  //
  // Step 1: Express validates password/email + soft-deletes (sets isDeleted, clears refresh token).
  //         If this throws, local state is untouched — full rollback by default.
  // Step 2: Cancel scheduler before any state mutation.
  // Step 3: Delete local user data directory (best-effort; account gone server-side).
  // Step 4: Remove refresh token from vault.
  // Step 5: Clear in-memory access token and user context.

  ipcMain.handle('auth:deleteAccount', async (_event, { password, confirmEmail }) => {
    try {
      // Step 1 — if server rejects, throw propagates to catch and nothing local is changed
      await authService.deleteAccount({ password, confirmEmail });

      // Step 2 — cancel before touching any state
      tokenRefreshScheduler.cancel();
      stopSubscriptionCheck();
      notificationStream.stopStream();

      // Step 3 — directory removal; account is already server-deleted so this is best-effort
      try {
        await userContextService.deleteUserDirectory();
      } catch { /* non-fatal */ }

      // Step 4
      tokenVault.remove();

      // Step 5
      authService.logout();
      userContextService.clear();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Google OAuth: Initiate ────────────────────────────────
  //
  // Opens the system browser to Google consent URL with a cloud callback.
  // The web-portal React app handles the code exchange and provides a
  // deep link (orvyn://auth/google) back to this app with tokens.
  // The renderer listens for 'deep-link:google-auth' events from main.js.

  ipcMain.handle('auth:initiateGoogleAuth', async () => {
    try {
      authService.initiateGoogleAuth();
      return { success: true, message: 'Browser opened for Google sign-in.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Google OAuth: Complete login via deep link ──────────────
  //
  // Called by the renderer after receiving tokens from the deep link
  // (orvyn://auth/google?action=login&token=...&refreshToken=...)

  ipcMain.handle('auth:completeGoogleAuth', async (_event, { accessToken, refreshToken, isNewUser }) => {
    try {
      log.info('[GoogleAuth] completeGoogleAuth called — hasAccessToken:', !!accessToken, 'hasRefreshToken:', !!refreshToken, 'isNewUser:', isNewUser);

      // Validate the token and get user info
      const user = await authService.validateToken(accessToken);
      log.info('[GoogleAuth] Token validated — userId:', user?._id, 'email:', user?.email);

      await userContextService.initializeUserDirectory(String(user._id));
      const databasePath = userContextService.getActiveDatabasePath();

      try {
        await pythonService.initDb(databasePath, String(user._id));
      } catch (err) {
        authService.logout();
        userContextService.clear();
        throw new Error(`Database initialisation failed: ${err.message}`);
      }

      let theme;
      try {
        theme = await pythonService.getTheme();
      } catch (err) {
        authService.logout();
        userContextService.clear();
        throw new Error(`Theme fetch failed: ${err.message}`);
      }

      // Store tokens
      try {
        tokenVault.store(refreshToken);
        log.info('[GoogleAuth] Refresh token stored in vault');
      } catch (vaultErr) {
        log.warn('[GoogleAuth] Vault store failed:', vaultErr.message);
      }

      // Set in-memory session state
      authService.setSession(accessToken, user);
      log.info('[GoogleAuth] Session set — getToken() null?', !authService.getToken());

      startRefreshScheduler();

      // Start periodic subscription check
      startSubscriptionCheck();

      // Open the real-time notifications stream
      notificationStream.startStream(getMainWindow);

      // Resume pending indexing (fire-and-forget)
      resumePendingIndexing(getMainWindow)
        .catch(() => { /* non-fatal */ });

      return {
        success: true,
        user,
        theme,
        isNewUser: isNewUser || false,
      };
    } catch (error) {
      log.error('[GoogleAuth] completeGoogleAuth failed:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Google OAuth: Link existing account ───────────────────

  ipcMain.handle('auth:linkGoogleAccount', async (_event, { email, password, googleId, picture }) => {
    try {
      const result = await authService.linkGoogleAccount(email, password, googleId, picture);

      // Same login sequence
      const user = result.user;
      await userContextService.initializeUserDirectory(String(user._id));
      const databasePath = userContextService.getActiveDatabasePath();

      try {
        await pythonService.initDb(databasePath, String(user._id));
      } catch (err) {
        authService.logout();
        userContextService.clear();
        throw new Error(`Database initialisation failed: ${err.message}`);
      }

      let theme;
      try {
        theme = await pythonService.getTheme();
      } catch (err) {
        authService.logout();
        userContextService.clear();
        throw new Error(`Theme fetch failed: ${err.message}`);
      }

      try {
        tokenVault.store(result.refreshToken);
      } catch { /* non-fatal */ }

      authService.setSession(result.accessToken, user);

      startRefreshScheduler();

      // Start periodic subscription check
      startSubscriptionCheck();

      // Open the real-time notifications stream
      notificationStream.startStream(getMainWindow);

      return { success: true, user, theme };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Forgot / Reset Password ───────────────────────────────

  ipcMain.handle('auth:forgotPassword', async (_event, { email }) => {
    try {
      const result = await authService.forgotPassword(email);
      return {
        success:         true,
        message:         result.message,
        cooldownSeconds: result.cooldownSeconds,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:verifyResetCode', async (_event, { email, code }) => {
    try {
      await authService.verifyResetCode(email, code);
      return { success: true };
    } catch (err) {
      return {
        success:           false,
        error:             err.message,
        retryAfterSeconds: err.retryAfterSeconds,
        attemptsLeft:      err.attemptsLeft,
      };
    }
  });

  ipcMain.handle('auth:resetPassword', async (_event, { email, code, newPassword }) => {
    try {
      await authService.resetPassword({ email, code, newPassword });
      return { success: true };
    } catch (err) {
      return {
        success:           false,
        error:             err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      };
    }
  });

  ipcMain.handle('auth:resendResetCode', async (_event, { email }) => {
    try {
      const result = await authService.resendResetCode(email);
      return {
        success:           true,
        cooldownSeconds:   result.cooldownSeconds,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Email Verification ────────────────────────────────────

  ipcMain.handle('auth:verifyEmail', async (_event, { email, code }) => {
    try {
      // Express now returns { accessToken, refreshToken, user } so the user
      // is logged in by the verify call itself — no second login required.
      const result = await authService.verifyEmail(email, code);

      if (!result.accessToken || !result.refreshToken || !result.user) {
        // Backwards-safety — verification succeeded but no session payload
        return { success: true, message: result.message };
      }

      const user = result.user;

      // Same post-login sequence as auth:login / auth:initiateGoogleAuth
      await userContextService.initializeUserDirectory(String(user._id));
      const databasePath = userContextService.getActiveDatabasePath();

      try {
        await pythonService.initDb(databasePath, String(user._id));
      } catch (initErr) {
        authService.logout();
        userContextService.clear();
        throw new Error(`Database initialisation failed: ${initErr.message}`);
      }

      let theme;
      try {
        theme = await pythonService.getTheme();
      } catch (themeErr) {
        authService.logout();
        userContextService.clear();
        throw new Error(`Theme fetch failed: ${themeErr.message}`);
      }

      try {
        tokenVault.store(result.refreshToken);
      } catch { /* non-fatal */ }

      authService.setSession(result.accessToken, user);
      startRefreshScheduler();
      startSubscriptionCheck();
      notificationStream.startStream(getMainWindow);
      resumePendingIndexing(getMainWindow).catch(() => { /* non-fatal */ });

      return { success: true, user, theme };
    } catch (err) {
      return {
        success:           false,
        error:             err.message,
        retryAfterSeconds: err.retryAfterSeconds,
        attemptsLeft:      err.attemptsLeft,
      };
    }
  });

  ipcMain.handle('auth:resendVerification', async (_event, { email }) => {
    try {
      const result = await authService.resendVerification(email);
      return {
        success:           true,
        cooldownSeconds:   result.cooldownSeconds,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Helpers ───────────────────────────────────────────────

  ipcMain.handle('auth:getCurrentUser', () => {
    try {
      const user = authService.getCurrentUser();
      return { success: true, user };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:getLocalDbPath', () => {
    try {
      const dbPath = userContextService.getActiveDatabasePath();
      return { success: true, dbPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Send Feedback ─────────────────────────────────────────

  ipcMain.handle('auth:sendFeedback', async (_event, { feedback }) => {
    try {
      await authService.sendFeedback({ feedback });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Set User Type ─────────────────────────────────────────

  ipcMain.handle('auth:setUserType', async (_event, userType) => {
    try {
      log.info('[setUserType] Called with:', userType, '— token null?', !authService.getToken(), '— user:', authService.getCurrentUser()?.email);

      // Guard: if in-memory token was lost (e.g. deep-link timing race),
      // attempt a one-shot recovery from the vault before giving up.
      if (!authService.getToken()) {
        log.warn('[setUserType] Token is NULL — attempting recovery from vault');
        const storedRefreshToken = tokenVault.read();
        log.info('[setUserType] Vault has token?', !!storedRefreshToken);
        if (storedRefreshToken) {
          try {
            const tokens = await authService.refreshTokens(storedRefreshToken);
            authService.setSession(tokens.accessToken, tokens.user);
            try { tokenVault.store(tokens.refreshToken); } catch { /* non-fatal */ }
            startRefreshScheduler();
            log.info('[setUserType] Recovery successful — token restored');
          } catch (recoverErr) {
            log.error('[setUserType] Recovery failed:', recoverErr.message);
          }
        }
      }

      const result = await expressService.setUserType(userType);
      // Refresh in-memory user so subsequent IPCs see the new userType
      if (result.user) {
        authService.setSession(authService.getToken(), result.user);
      }
      return { success: true, user: result.user };
    } catch (err) {
      log.error('[setUserType] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

}

module.exports = registerAuthHandlers;

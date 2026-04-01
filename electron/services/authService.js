/**
 * Auth Service — runs exclusively in the Electron main process.
 *
 * Responsibilities:
 *   - Make HTTP requests to the Express auth backend.
 *   - Hold the ACCESS token in main-process memory only.
 *   - Never expose any token to the renderer process.
 *
 * Token model:
 *   - Access token  → 15-minute JWT, lives only in _token (memory)
 *   - Refresh token → 7-day JWT, stored encrypted in tokenVault by callers
 */

const http   = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { app, shell } = require('electron');
const config = require('../config');
const log    = require('./logger');

// ── Load logo as base64 data URI (works in both dev and packaged builds) ──
let _logoDataUri = '';
try {
  const logoPath = app.isPackaged
    ? path.join(process.resourcesPath, 'frontend', 'dist', 'logo.png')
    : path.join(__dirname, '..', '..', 'frontend', 'public', 'logo.png');
  const logoBuffer = fs.readFileSync(logoPath);
  _logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
} catch (err) {
  log.warn('Could not load logo.png for OAuth callback page:', err.message);
}

let _token = null;   // Access token — in-process memory only
let _user  = null;

function getExpressUrl() {
  return config.EXPRESS_URL;
}

// ── Registration ──────────────────────────────────────────

async function register({ name, email, password }) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed.');
  return data;
}

// ── Login ─────────────────────────────────────────────────

/**
 * Authenticates against Express. Stores the access token in memory.
 *
 * @returns {{ user: object, refreshToken: string }}
 *   user         — sanitized user object (no password, no tokens)
 *   refreshToken — plain JWT; caller must store it in tokenVault
 */
async function login({ email, password }) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed.');

  // Access token stored in memory only — never leaves the main process
  _token = data.accessToken;
  _user  = data.user;

  return { user: _user, refreshToken: data.refreshToken };
}

// ── Token Refresh ─────────────────────────────────────────

/**
 * Exchanges a refresh token for a new access + refresh token pair.
 * Rotates the refresh token — the old one is invalidated server-side.
 * Updates the in-memory access token on success.
 *
 * @param {string} refreshToken - The stored refresh JWT
 * @returns {{ accessToken: string, refreshToken: string, user: object }}
 * @throws {Error} On network failure or if the refresh token is rejected
 */
async function refreshTokens(refreshToken) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token refresh failed.');

  // Update in-memory access token with the newly issued one
  _token = data.accessToken;
  _user  = data.user;

  return {
    accessToken:  data.accessToken,
    refreshToken: data.refreshToken,
    user:         data.user,
  };
}

// ── Server-Side Revocation ────────────────────────────────

/**
 * Asks Express to invalidate the refresh token in MongoDB.
 * Best-effort — a network failure does not prevent local logout.
 *
 * @param {string} refreshToken - The refresh JWT to revoke
 */
async function revokeRefreshToken(refreshToken) {
  try {
    await fetch(`${getExpressUrl()}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Intentionally swallowed. The local session is cleared regardless.
  }
}

// ── Session Restore ───────────────────────────────────────

/**
 * Validates a stored access token against /api/v1/auth/me.
 * Used as a guard check where the refresh flow is not applicable.
 *
 * @param {string} token - Access JWT
 * @returns {Promise<object>} Sanitized user object
 */
async function validateToken(token) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token validation failed.');
  return data.user;
}

/**
 * Restores in-memory session state without an HTTP call.
 * Used after a successful token refresh during startup restore.
 *
 * @param {string} accessToken - The newly issued access JWT
 * @param {object} user        - Sanitized user object from Express
 */
function setSession(accessToken, user) {
  _token = accessToken;
  _user  = user;
}

// ── Email Verification ────────────────────────────────────

async function verifyEmail(email, code) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Email verification failed.');
    err.retryAfterSeconds = data.retryAfterSeconds;
    err.attemptsLeft      = data.attemptsLeft;
    throw err;
  }
  return data;
}

// ── Resend Verification ───────────────────────────────────

async function resendVerification(email) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Resend failed.');
  return data;
}

// ── Forgot Password ───────────────────────────────────────

async function forgotPassword(email) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

// ── Verify Reset Code ─────────────────────────────────────

async function verifyResetCode(email, code) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/verify-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Reset code verification failed.');
    err.retryAfterSeconds = data.retryAfterSeconds;
    err.attemptsLeft      = data.attemptsLeft;
    throw err;
  }
  return data;
}

// ── Reset Password (code-based) ───────────────────────────

async function resetPassword({ email, code, newPassword }) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Password reset failed.');
    err.retryAfterSeconds = data.retryAfterSeconds;
    throw err;
  }
  return data;
}

// ── Resend Reset Code ─────────────────────────────────────

async function resendResetCode(email) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/resend-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Resend failed.');
  return data;
}

// ── Delete Account ────────────────────────────────────────

async function deleteAccount({ password, confirmEmail }) {
  const body = {};
  if (password)     body.password     = password;
  if (confirmEmail) body.confirmEmail = confirmEmail;

  const res = await fetch(`${getExpressUrl()}/api/v1/auth/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Account deletion failed.');
  return data;
}

// ── Logout ────────────────────────────────────────────────

function logout() {
  _token = null;
  _user  = null;
}

// ── Accessors ─────────────────────────────────────────────

function getCurrentUser() { return _user; }

// Returns the access token for use by other Electron services only.
// Never passed to the renderer.
function getToken() { return _token; }

// ── Send Feedback ────────────────────────────────────────

async function sendFeedback({ feedback }) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${_token}`,
    },
    body: JSON.stringify({ feedback }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send feedback.');
  return data;
}

// ── Google OAuth ─────────────────────────────────────────

let _googleAuthServer = null;
let _googleAuthState  = null;

/**
 * Start Google OAuth flow.
 * 1. Spin up temporary localhost server
 * 2. Open system browser with Google consent URL
 * 3. Wait for callback with authorization code
 * Returns { code, redirectUri }
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

        const code  = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        // Capture port before closing server
        const serverPort = _googleAuthServer.address().port;

        // Send branded HTML response to browser
        const isSuccess = !error;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orvyn — ${isSuccess ? 'Authentication Successful' : 'Authentication Failed'}</title>
  ${_logoDataUri ? `<link rel="icon" type="image/png" href="${_logoDataUri}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #F8FAF9;
      background-image:
        radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 70%),
        radial-gradient(ellipse 60% 50% at 80% 100%, rgba(16,185,129,0.05) 0%, transparent 70%);
      color: #1a1a2e;
      overflow: hidden;
      position: relative;
    }

    /* Floating ambient orbs */
    .orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.4;
      pointer-events: none;
      animation: orbFloat 8s ease-in-out infinite alternate;
    }
    .orb-1 {
      width: 300px; height: 300px;
      background: rgba(16,185,129,0.12);
      top: -80px; left: -80px;
      animation-duration: 10s;
    }
    .orb-2 {
      width: 200px; height: 200px;
      background: rgba(52,211,153,0.10);
      bottom: -60px; right: -60px;
      animation-duration: 12s;
      animation-delay: -3s;
    }
    .orb-3 {
      width: 150px; height: 150px;
      background: rgba(16,185,129,0.08);
      top: 40%; right: 10%;
      animation-duration: 9s;
      animation-delay: -5s;
    }

    @keyframes orbFloat {
      from { transform: translate(0, 0) scale(1); }
      to   { transform: translate(30px, -20px) scale(1.1); }
    }

    /* Main card */
    .card {
      text-align: center;
      padding: 56px 48px 48px;
      max-width: 460px;
      width: 92%;
      background: rgba(255,255,255,0.85);
      border: 1px solid rgba(16,185,129,0.12);
      border-radius: 24px;
      backdrop-filter: blur(20px);
      box-shadow:
        0 4px 24px rgba(0,0,0,0.04),
        0 1px 3px rgba(0,0,0,0.03),
        0 20px 60px rgba(16,185,129,0.06);
      animation: cardIn 0.5s cubic-bezier(0.16,1,0.3,1);
      position: relative;
      z-index: 1;
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(24px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Logo section */
    .logo-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 36px;
    }
    .logo-icon {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #10B981, #059669);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 20px;
      box-shadow: 0 2px 8px rgba(16,185,129,0.3);
    }
    .logo-img {
      width: 42px;
      height: 42px;
      object-fit: contain;
      border-radius: 10px;
      filter: drop-shadow(0 2px 6px rgba(16,185,129,0.25));
    }
    .logo-text {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: linear-gradient(135deg, #10B981, #059669);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Status icon */
    .status-icon {
      width: 80px; height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 28px;
      position: relative;
      animation: iconPop 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both;
    }
    .status-icon.success {
      background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(52,211,153,0.08));
      border: 2px solid rgba(16,185,129,0.2);
    }
    .status-icon.error {
      background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(248,113,113,0.06));
      border: 2px solid rgba(239,68,68,0.2);
    }

    /* Pulse ring behind icon */
    .status-icon::after {
      content: '';
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      ${isSuccess
        ? 'border: 2px solid rgba(16,185,129,0.15);'
        : 'border: 2px solid rgba(239,68,68,0.12);'}
      animation: pulseRing 2s ease-out infinite;
    }

    .status-icon svg {
      width: 36px; height: 36px;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }
    .status-icon.success svg {
      stroke: #10B981;
      stroke-dasharray: 30;
      stroke-dashoffset: 30;
      animation: drawCheck 0.6s ease 0.4s forwards;
    }
    .status-icon.error svg { stroke: #EF4444; }

    @keyframes iconPop {
      from { opacity: 0; transform: scale(0.5); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes pulseRing {
      0%   { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.3); opacity: 0; }
    }
    @keyframes drawCheck {
      to { stroke-dashoffset: 0; }
    }

    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 10px;
      color: #111827;
      letter-spacing: -0.02em;
      animation: textIn 0.4s ease 0.3s both;
    }
    .subtitle {
      font-size: 15px;
      color: #6B7280;
      line-height: 1.6;
      margin-bottom: 32px;
      animation: textIn 0.4s ease 0.4s both;
    }

    @keyframes textIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Action button */
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 13px 32px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      animation: textIn 0.4s ease 0.5s both;
      letter-spacing: 0.01em;
    }
    .action-btn.success {
      color: white;
      background: linear-gradient(135deg, #10B981, #059669);
      box-shadow: 0 4px 14px rgba(16,185,129,0.3);
    }
    .action-btn.success:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(16,185,129,0.4);
    }
    .action-btn.success:active {
      transform: translateY(0);
    }
    .action-btn.error {
      color: #DC2626;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.15);
    }
    .action-btn.error:hover {
      background: rgba(239,68,68,0.12);
      transform: translateY(-1px);
    }

    .btn-icon {
      width: 16px; height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Footer hint */
    .footer-hint {
      margin-top: 20px;
      font-size: 12px;
      color: #9CA3AF;
      animation: textIn 0.4s ease 0.6s both;
    }
    .footer-hint .dot {
      display: inline-block;
      width: 6px; height: 6px;
      background: #10B981;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
      animation: dotPulse 1.5s ease-in-out infinite;
    }
    @keyframes dotPulse {
      0%, 100% { opacity: 0.4; transform: scale(0.8); }
      50%      { opacity: 1;   transform: scale(1.2); }
    }

    /* Confetti canvas (success only) */
    #confetti {
      position: fixed;
      inset: 0;
      z-index: 10;
      pointer-events: none;
    }

    /* Floating particles */
    .particle {
      position: fixed;
      width: 6px; height: 6px;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      z-index: 0;
    }
    .particle-1 { background: rgba(16,185,129,0.3); left: 15%; top: 20%; animation: particleDrift 6s ease-in-out 0.5s infinite; }
    .particle-2 { background: rgba(52,211,153,0.25); right: 20%; top: 35%; animation: particleDrift 8s ease-in-out 1s infinite; }
    .particle-3 { background: rgba(16,185,129,0.2); left: 30%; bottom: 25%; animation: particleDrift 7s ease-in-out 1.5s infinite; }
    .particle-4 { background: rgba(5,150,105,0.2); right: 15%; bottom: 30%; animation: particleDrift 9s ease-in-out 2s infinite; }
    .particle-5 { background: rgba(16,185,129,0.15); left: 60%; top: 15%; animation: particleDrift 10s ease-in-out 0s infinite; }

    @keyframes particleDrift {
      0%   { opacity: 0; transform: translateY(0) scale(0.5); }
      15%  { opacity: 1; }
      50%  { transform: translateY(-40px) scale(1.2); opacity: 0.7; }
      85%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(0) scale(0.5); }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .card { padding: 40px 28px 36px; }
      h1 { font-size: 20px; }
    }
  </style>
</head>
<body>
  <!-- Ambient orbs -->
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>

  <!-- Floating particles -->
  <div class="particle particle-1"></div>
  <div class="particle particle-2"></div>
  <div class="particle particle-3"></div>
  <div class="particle particle-4"></div>
  <div class="particle particle-5"></div>

  ${isSuccess ? '<canvas id="confetti"></canvas>' : ''}

  <div class="card">
    <div class="logo-row">
      ${_logoDataUri ? `<img class="logo-img" src="${_logoDataUri}" alt="Orvyn logo">` : '<div class="logo-icon">O</div>'}
      <div class="logo-text">Orvyn</div>
    </div>

    <div class="status-icon ${isSuccess ? 'success' : 'error'}">
      ${isSuccess
        ? '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>'
        : '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}
    </div>

    <h1>${isSuccess ? "You're all set!" : 'Something went wrong'}</h1>
    <p class="subtitle">${isSuccess
        ? "Your Google account has been verified and you're now signed into Orvyn."
        : "We couldn't complete the authentication. Please try again from the Orvyn app."}</p>

    <p class="footer-hint">
      ${isSuccess
        ? '<span class="dot"></span>You can now return to Orvyn'
        : 'You can safely close this tab'}
    </p>
  </div>

  <script>
    ${isSuccess ? `
    // Mini confetti burst
    (function() {
      var c = document.getElementById('confetti');
      if (!c) return;
      var ctx = c.getContext('2d');
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      var colors = ['#10B981','#34D399','#6EE7B7','#A7F3D0','#059669','#047857'];
      var pieces = [];
      for (var i = 0; i < 80; i++) {
        pieces.push({
          x: c.width / 2 + (Math.random()-0.5)*200,
          y: c.height / 2 - 60,
          w: Math.random()*8+4,
          h: Math.random()*4+2,
          vx: (Math.random()-0.5)*12,
          vy: Math.random()*-14 - 4,
          color: colors[Math.floor(Math.random()*colors.length)],
          rotation: Math.random()*360,
          rv: (Math.random()-0.5)*12,
          gravity: 0.25 + Math.random()*0.1,
          opacity: 1
        });
      }
      function draw() {
        ctx.clearRect(0,0,c.width,c.height);
        var alive = false;
        pieces.forEach(function(p) {
          if (p.opacity <= 0) return;
          alive = true;
          p.vy += p.gravity;
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.99;
          p.rotation += p.rv;
          if (p.y > c.height + 20) p.opacity = 0;
          if (p.y > c.height * 0.7) p.opacity -= 0.02;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation * Math.PI / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
          ctx.restore();
        });
        if (alive) requestAnimationFrame(draw);
      }
      setTimeout(draw, 300);
    })();
    setTimeout(function(){ window.close(); }, 4000);
    ` : ''}
  </script>
</body>
</html>`);

        // Clean up server
        _googleAuthServer.close();
        _googleAuthServer = null;

        if (error) {
          reject(new Error(`Google auth error: ${error}`));
          return;
        }

        // Verify CSRF state
        if (state !== _googleAuthState) {
          reject(new Error('Invalid state parameter — possible CSRF attack'));
          return;
        }

        resolve({ code, redirectUri: `http://127.0.0.1:${serverPort}/callback` });
      } catch (err) {
        reject(err);
      }
    });

    // Listen on random port
    _googleAuthServer.listen(0, '127.0.0.1', () => {
      const port = _googleAuthServer.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;

      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleAuthUrl.searchParams.set('client_id', config.GOOGLE_CLIENT_ID);
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
async function googleLogin(code, redirectUri, mode) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri, mode }),
  });

  const data = await res.json();
  if (!res.ok) {
    // Pass through structured error flags (noAccount, alreadyExists)
    if (data.noAccount || data.alreadyExists) return data;
    throw new Error(data.error || 'Google login failed');
  }
  return data;
}

/**
 * Link Google to existing local account.
 */
async function linkGoogleAccount(email, password, googleId, picture) {
  const res = await fetch(`${getExpressUrl()}/api/v1/auth/google/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, googleId, picture }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Account linking failed');
  return data;
}

module.exports = {
  register,
  login,
  refreshTokens,
  revokeRefreshToken,
  validateToken,
  setSession,
  verifyEmail,
  resendVerification,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  resendResetCode,
  deleteAccount,
  sendFeedback,
  logout,
  getCurrentUser,
  getToken,
  initiateGoogleAuth,
  googleLogin,
  linkGoogleAccount,
};

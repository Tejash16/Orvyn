/**
 * Centralized configuration — Electron main process only.
 *
 * In dev:  reads from electron/.env (loaded by dotenv in main.js).
 * In prod: uses hardcoded production defaults (no .env file ships with the app).
 *
 * Single source of truth for all environment-dependent values.
 * Update the production URL here after deploying Express to Cloud Run.
 */

const { app } = require('electron');
 
const isDev = !app.isPackaged;

// ── Production Cloud Run URL ────────────────────────────────
// Replace this placeholder with your actual Cloud Run URL after deployment.
const PRODUCTION_EXPRESS_URL = 'https://orvyn-express-160954399633.asia-south1.run.app';

// ── Production Google OAuth client ID ───────────────────────
// Not a secret — sent publicly to Google in the consent URL.
// Must match the GOOGLE_CLIENT_ID configured in express-backend (GCP secret).
const PRODUCTION_GOOGLE_CLIENT_ID = '444425904275-uvo3bq09vcl23qura8r2t9taklqok6rk.apps.googleusercontent.com';

module.exports = {
  EXPRESS_URL: isDev
    ? (process.env.EXPRESS_URL || 'http://localhost:8080')
    : PRODUCTION_EXPRESS_URL,

  GOOGLE_CLIENT_ID: isDev
    ? (process.env.GOOGLE_CLIENT_ID || '')
    : PRODUCTION_GOOGLE_CLIENT_ID,

  COPILOT_PANEL_DEFAULT_WIDTH: parseInt(process.env.COPILOT_PANEL_DEFAULT_WIDTH) || 380,
  COPILOT_PANEL_MIN_WIDTH:     parseInt(process.env.COPILOT_PANEL_MIN_WIDTH)     || 320,
  COPILOT_PANEL_MAX_WIDTH:     parseInt(process.env.COPILOT_PANEL_MAX_WIDTH)     || 600,
};

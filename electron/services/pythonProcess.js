/**
 * Python Process Manager — Electron main process only.
 *
 * Spawns and supervises the local Python FastAPI backend.
 * Restarts automatically on unexpected exit (crash recovery).
 * Uses the venv Python executable as required for Windows.
 *
 * Renderer has no knowledge of this service.
 */

const { spawn } = require('child_process');
const { app }   = require('electron');
const path      = require('path');

// ── Paths ─────────────────────────────────────────────────

// __dirname is electron/services/ → ../../python-backend
const PYTHON_DIR    = path.join(__dirname, '..', '..', 'python-backend');
const PYTHON_EXE    = path.join(PYTHON_DIR, 'venv', 'Scripts', 'python.exe');
const PYTHON_SCRIPT = 'run.py';

const RESTART_DELAY_MS = 3_000;  // Wait before respawn to prevent tight loops
const MAX_RESTARTS     = 5;      // Give up after this many consecutive rapid crashes

// ── State ─────────────────────────────────────────────────

let _process       = null;
let _shouldRestart = false;
let _restartCount  = 0;
let _lastStartTime = 0;

// ── Internal ──────────────────────────────────────────────

function _spawn() {
  if (!_shouldRestart) return;

  _lastStartTime = Date.now();
  _restartCount  = 0; // will be checked in exit handler

  const stdio = app.isPackaged ? 'ignore' : 'inherit';

  _process = spawn(PYTHON_EXE, [PYTHON_SCRIPT], {
    cwd:   PYTHON_DIR,
    stdio,
    windowsHide: true,
  });

  _process.on('error', (err) => {
    _process = null;
    if (_shouldRestart) {
      console.error(`[Python] Spawn error: ${err.message}. Retrying in ${RESTART_DELAY_MS}ms…`);
      _scheduleRestart();
    }
  });

  _process.on('exit', (code, signal) => {
    _process = null;
    if (!_shouldRestart) return; // Intentional stop

    const uptimeSecs = (Date.now() - _lastStartTime) / 1000;
    if (uptimeSecs < 5) {
      _restartCount++;
    } else {
      _restartCount = 0; // Process ran for a while — reset the crash counter
    }

    if (_restartCount >= MAX_RESTARTS) {
      console.error('[Python] Too many rapid restarts. Giving up.');
      _shouldRestart = false;
      return;
    }

    console.warn(`[Python] Exited (code=${code}, signal=${signal}). Restarting in ${RESTART_DELAY_MS}ms…`);
    _scheduleRestart();
  });
}

function _scheduleRestart() {
  setTimeout(_spawn, RESTART_DELAY_MS);
}

// ── Public API ────────────────────────────────────────────

/**
 * Starts the Python backend process.
 * Idempotent — safe to call if already running.
 */
function start() {
  if (_process) return; // Already running
  _shouldRestart = true;
  _restartCount  = 0;
  _spawn();
}

/**
 * Terminates the Python backend and disables auto-restart.
 * Called on app quit to ensure a clean shutdown.
 */
function stop() {
  _shouldRestart = false;
  if (_process) {
    _process.kill();
    _process = null;
  }
}

module.exports = { start, stop };

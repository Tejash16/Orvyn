'use strict';

const http  = require('http');
const https = require('https');
const { URL } = require('url');

const authService    = require('../services/authService');
const expressService = require('../services/expressService');
const log            = require('../services/logger');

async function apiRequest(method, pathSuffix) {
  try {
    const token = authService.getToken();
    const res = await fetch(`${expressService.getExpressUrl()}/api/v1/notifications${pathSuffix}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  } catch (err) {
    log.error(`notifications ${method} ${pathSuffix} failed:`, err.message);
    return { error: err.message };
  }
}

// ── SSE client ────────────────────────────────────────────
//
// Holds a long-lived HTTP connection to /api/v1/notifications/stream and
// forwards every `data:` frame to the renderer as `notification:new`.
// The bearer token never leaves the main process.

const BACKOFF_MIN_MS = 1000;
const BACKOFF_MAX_MS = 30000;

let currentReq     = null;
let reconnectTimer = null;
let backoff        = BACKOFF_MIN_MS;
let stopped        = true;
let windowGetter   = null;

function scheduleReconnect() {
  if (stopped) return;
  const delay = Math.min(backoff, BACKOFF_MAX_MS);
  backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
  reconnectTimer = setTimeout(connect, delay);
}

function connect() {
  reconnectTimer = null;
  if (stopped) return;

  const token = authService.getToken();
  if (!token) {
    // Token may not be set yet during a race; retry shortly.
    scheduleReconnect();
    return;
  }

  let url;
  try {
    url = new URL(`${expressService.getExpressUrl()}/api/v1/notifications/stream`);
  } catch (err) {
    log.error('SSE stream: bad URL —', err.message);
    scheduleReconnect();
    return;
  }

  const lib = url.protocol === 'https:' ? https : http;
  const req = lib.request(
    {
      protocol: url.protocol,
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers: {
        Authorization:   `Bearer ${token}`,
        Accept:          'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    },
    (res) => {
      if (res.statusCode !== 200) {
        log.warn(`SSE stream: status ${res.statusCode}`);
        res.resume();
        currentReq = null;
        scheduleReconnect();
        return;
      }
      log.info('SSE stream: connected');
      backoff = BACKOFF_MIN_MS;

      let buffer = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const dataLines = raw
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).replace(/^ /, ''));
          if (dataLines.length === 0) continue;

          try {
            const payload = JSON.parse(dataLines.join('\n'));
            const win = windowGetter && windowGetter();
            if (win && !win.isDestroyed()) {
              win.webContents.send('notification:new', payload);
            }
          } catch (err) {
            log.warn('SSE stream: bad JSON frame —', err.message);
          }
        }
      });

      res.on('end', () => {
        log.info('SSE stream: ended');
        currentReq = null;
        scheduleReconnect();
      });

      res.on('error', (err) => {
        log.warn('SSE stream: response error —', err.message);
        currentReq = null;
        scheduleReconnect();
      });
    },
  );

  req.on('error', (err) => {
    log.warn('SSE stream: request error —', err.message);
    currentReq = null;
    scheduleReconnect();
  });

  req.end();
  currentReq = req;
}

function startStream(getMainWindow) {
  windowGetter = getMainWindow;
  if (!stopped) return; // already running
  stopped = false;
  backoff = BACKOFF_MIN_MS;
  connect();
}

function stopStream() {
  stopped = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (currentReq) {
    try { currentReq.destroy(); } catch { /* ignore */ }
    currentReq = null;
  }
  backoff = BACKOFF_MIN_MS;
  log.info('SSE stream: stopped');
}

function registerNotificationHandlers(ipcMain) {
  ipcMain.handle('notification:list', async (_e, { since, unread } = {}) => {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (unread) params.set('unread', 'true');
    const qs = params.toString();
    return apiRequest('GET', qs ? `/?${qs}` : '/');
  });

  ipcMain.handle('notification:markRead', (_e, { id }) => apiRequest('POST', `/${id}/read`));
  ipcMain.handle('notification:markAllRead', () => apiRequest('POST', '/read-all'));
}

module.exports = { registerNotificationHandlers, startStream, stopStream };

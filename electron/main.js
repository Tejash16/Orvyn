const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const log = require('./services/logger');

const registerWindowControls    = require('./ipc/windowControls');
const registerAuthHandlers     = require('./ipc/authHandlers');
const registerSettingsHandlers = require('./ipc/settingsHandlers');
const registerDataroomHandlers = require('./ipc/dataroomHandlers');
const registerFolderHandlers   = require('./ipc/folderHandlers');
const registerFileHandlers     = require('./ipc/fileHandlers');
const registerAiHandlers       = require('./ipc/aiHandlers');
const { registerCopilotHandlers } = require('./ipc/copilotHandlers');
const pythonProcess            = require('./services/pythonProcess');

let mainWindow;

// ── Single Instance Lock ─────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running — quit immediately
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to open a second instance — focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // app.isPackaged is false when running via `electron .` in dev
  if (!app.isPackaged) {
    const devPort = process.env.VITE_DEV_PORT || 5173;
    mainWindow.loadURL(`http://localhost:${devPort}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Register IPC handlers ─────────────────────────────────

registerWindowControls(ipcMain, () => mainWindow);

// Auth handlers receive a mainWindow getter so they can push events
// (session expired, offline status) to the renderer without polling.
registerAuthHandlers(ipcMain, () => mainWindow);

registerSettingsHandlers(ipcMain);
registerDataroomHandlers(ipcMain);
registerFolderHandlers(ipcMain);
registerFileHandlers(ipcMain, () => mainWindow);
registerAiHandlers(ipcMain, () => mainWindow);
registerCopilotHandlers(ipcMain, () => mainWindow);

// Runtime config — sourced from electron/.env, never from renderer
ipcMain.handle('app:getConfig', () => ({
  expressUrl: process.env.EXPRESS_URL || '',
  pythonUrl:  process.env.PYTHON_URL  || '',
}));

// Logs path — lets the renderer offer a "Help > Open Logs" action
ipcMain.handle('app:getLogsPath', () => log.getLogsPath());
ipcMain.handle('app:openLogsFolder', async () => {
  const logsPath = log.getLogsPath();
  await shell.openPath(logsPath);
  return { success: true };
});

// ── Startup ───────────────────────────────────────────────

app.whenReady().then(async () => {
  log.info('Orvyn starting up');
  // Spawn the local Python backend before the window opens.
  // start() finds a free port dynamically, then spawns Python.
  // The renderer's session restore flow waits for Python health before proceeding.
  await pythonProcess.start();
  createWindow();

  // Startup recovery of pending indexing jobs is now triggered from
  // authHandlers after login/session-restore completes (when user context
  // is guaranteed to be available). See auth:login and auth:restoreSession.
});

// ── Shutdown ──────────────────────────────────────────────

app.on('will-quit', () => {
  log.info('Orvyn shutting down');
  // Stop Python cleanly on every quit path (window close, system shutdown, etc.)
  pythonProcess.stop();
});

app.on('window-all-closed', () => {
  app.quit();
});

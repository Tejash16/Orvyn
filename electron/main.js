const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const registerWindowControls = require('./ipc/windowControls');

let mainWindow;

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

  // Notify renderer when window maximize state changes
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

// Register IPC handlers
registerWindowControls(ipcMain, () => mainWindow);

// Expose runtime config to the renderer via preload
ipcMain.handle('app:getConfig', () => {
  return {
    expressUrl: process.env.EXPRESS_URL || '',
    pythonUrl: process.env.PYTHON_URL || '',
  };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

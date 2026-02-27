const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window control methods called from the React Header component
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),

    // Returns a cleanup function — call it in useEffect cleanup to avoid leaks
    onMaximizeChange: (callback) => {
      const handler = (_event, isMaximized) => callback(isMaximized);
      ipcRenderer.on('window:maximized', handler);
      return () => ipcRenderer.removeListener('window:maximized', handler);
    },
  },

  // Runtime configuration sourced from electron/.env
  getConfig: () => ipcRenderer.invoke('app:getConfig'),

  // Auth bridge — JWTs never cross into the renderer.
  // Database paths are derived from main-process state and cannot be
  // influenced by the renderer.
  auth: {
    register:       (payload) => ipcRenderer.invoke('auth:register', payload),
    login:          (payload) => ipcRenderer.invoke('auth:login', payload),
    logout:         ()        => ipcRenderer.invoke('auth:logout'),
    deleteAccount:         (password) => ipcRenderer.invoke('auth:deleteAccount', { password }),
    verifyEmail:           (email, code)               => ipcRenderer.invoke('auth:verifyEmail', { email, code }),
    resendVerification:    (email)                    => ipcRenderer.invoke('auth:resendVerification', { email }),
    forgotPassword:        (email)                    => ipcRenderer.invoke('auth:forgotPassword', { email }),
    resetPassword:         (token, newPassword)       => ipcRenderer.invoke('auth:resetPassword', { token, newPassword }),
    getCurrentUser: ()        => ipcRenderer.invoke('auth:getCurrentUser'),
    getLocalDbPath: ()        => ipcRenderer.invoke('auth:getLocalDbPath'),
    // Called once on app mount — Electron performs the entire restore sequence.
    restoreSession: ()        => ipcRenderer.invoke('auth:restoreSession'),

    // Push event: Electron notifies the renderer when the session has expired
    // and cannot be silently renewed (revoked or expired refresh token).
    // Returns a cleanup function for useEffect.
    onSessionExpired: (callback) => {
      const handler = () => callback();
      ipcRenderer.once('auth:sessionExpired', handler);
      return () => ipcRenderer.removeListener('auth:sessionExpired', handler);
    },
  },

  // Settings bridge — theme persisted via Electron → Python → SQLite.
  settings: {
    setTheme: (theme) => ipcRenderer.invoke('settings:setTheme', theme),
  },

  // App-level push events from the main process
  app: {
    // Fires when the background token refresh detects a network change.
    // callback(isOnline: boolean) — true = back online, false = went offline
    // Returns a cleanup function for useEffect.
    onOfflineStatus: (callback) => {
      const handler = (_event, isOnline) => callback(isOnline);
      ipcRenderer.on('app:offlineStatus', handler);
      return () => ipcRenderer.removeListener('app:offlineStatus', handler);
    },
  },
});

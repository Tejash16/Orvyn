const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window control methods called from the React Header component
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),

    // Returns a cleanup function — call it in useEffect cleanup to avoid leaks
    onMaximizeChange: (callback) => {
      const handler = (_event, isMaximized) => callback(isMaximized);
      ipcRenderer.on('window:maximized', handler);
      return () => ipcRenderer.removeListener('window:maximized', handler);
    },
  },

  // Runtime configuration sourced from electron/.env
  getConfig: () => ipcRenderer.invoke('app:getConfig'),
});

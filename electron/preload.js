const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('raagaXDesktop', {
  isElectron: true,
  platform: 'win32',
  onMediaKey: (callback) => {
    ipcRenderer.on('media-key', (_event, action) => callback(action));
  },
  sendPlaybackState: (state) => {
    ipcRenderer.send('playback-state-update', state);
  }
});

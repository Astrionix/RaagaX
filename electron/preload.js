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

// Inject non-intrusive drag region for frameless Windows titlebar
window.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('is-electron');

  if (!document.getElementById('electron-drag-region')) {
    const dragRegion = document.createElement('div');
    dragRegion.id = 'electron-drag-region';
    dragRegion.style.position = 'fixed';
    dragRegion.style.top = '0';
    dragRegion.style.left = '0';
    dragRegion.style.width = 'calc(100% - 140px)';
    dragRegion.style.height = '36px';
    dragRegion.style.zIndex = '35';
    dragRegion.style.pointerEvents = 'auto';
    dragRegion.style.webkitAppRegion = 'drag';
    document.body.appendChild(dragRegion);
  }
});


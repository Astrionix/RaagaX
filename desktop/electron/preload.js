const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,

  // Google / YouTube Authentication
  openGoogleLogin: () => ipcRenderer.invoke("auth:google-login"),
  signOutGoogle: () => ipcRenderer.invoke("auth:google-logout"),

  // Media Shortcut Listeners
  onMediaTogglePlay: (callback) => {
    ipcRenderer.on("media:toggle-play", () => callback());
  },
  onMediaNext: (callback) => {
    ipcRenderer.on("media:next", () => callback());
  },
  onMediaPrev: (callback) => {
    ipcRenderer.on("media:prev", () => callback());
  },

  // Discord Rich Presence
  setDiscordActivity: (activity) => ipcRenderer.send("discord:set-activity", activity),
  clearDiscordActivity: () => ipcRenderer.send("discord:clear-activity"),

  // Window Controls
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
});

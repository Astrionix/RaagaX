const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, protocol, net, shell } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

// Enable autoplay without user interaction (crucial for remote speaker playback)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Prevent audio pauses/stutters when minimized or backgrounded
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Register privileged standard app scheme for static Next.js assets
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    }
  }
]);

let mainWindow = null;
let tray = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

function getIconPath() {
  const possiblePaths = [
    path.join(__dirname, '../public/app-icon.png'),
    path.join(__dirname, '../out/app-icon.png'),
    path.join(__dirname, '../public/favicon.ico'),
    path.join(__dirname, '../out/favicon.ico')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function setupProtocol() {
  protocol.handle('app', (request) => {
    const parsed = new URL(request.url);
    let pathname = decodeURIComponent(parsed.pathname);

    if (pathname === '/' || !pathname) {
      pathname = '/index.html';
    }

    const outDir = path.resolve(__dirname, '..', 'out');
    let target = path.join(outDir, pathname);

    if (!fs.existsSync(target)) {
      if (fs.existsSync(target + '.html')) {
        target = target + '.html';
      } else if (fs.existsSync(path.join(target, 'index.html'))) {
        target = path.join(target, 'index.html');
      } else {
        target = path.join(outDir, 'index.html');
      }
    }

    return net.fetch(url.pathToFileURL(target).toString());
  });
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#060709',
    title: 'RaagaX Lossless Pro',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#060709',
      symbolColor: '#FFFFFF',
      height: 38
    },
    autoHideMenuBar: true,
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    show: false,
  });

  const startUrl = isDev && process.env.ELECTRON_START_URL
    ? process.env.ELECTRON_START_URL
    : 'app://-/index.html';

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      shell.openExternal(targetUrl);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  registerMediaKeys();
  createTray(iconPath);
}

function registerMediaKeys() {
  try {
    globalShortcut.register('MediaPlayPause', () => {
      mainWindow?.webContents.send('media-key', 'TOGGLE_PLAY');
    });
    globalShortcut.register('MediaNextTrack', () => {
      mainWindow?.webContents.send('media-key', 'NEXT');
    });
    globalShortcut.register('MediaPreviousTrack', () => {
      mainWindow?.webContents.send('media-key', 'PREV');
    });
    globalShortcut.register('MediaStop', () => {
      mainWindow?.webContents.send('media-key', 'PAUSE');
    });
  } catch (err) {
    console.warn('[Electron] Failed to register global media shortcuts:', err);
  }
}

function createTray(iconPath) {
  if (tray || !iconPath) return;
  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('RaagaX Lossless Pro');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Play / Pause',
        click: () => mainWindow?.webContents.send('media-key', 'TOGGLE_PLAY')
      },
      {
        label: 'Next Track',
        click: () => mainWindow?.webContents.send('media-key', 'NEXT')
      },
      {
        label: 'Previous Track',
        click: () => mainWindow?.webContents.send('media-key', 'PREV')
      },
      { type: 'separator' },
      {
        label: 'Open RaagaX',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.warn('[Electron] Failed to create system tray:', err);
  }
}

app.whenReady().then(() => {
  setupProtocol();
  createWindow();

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});


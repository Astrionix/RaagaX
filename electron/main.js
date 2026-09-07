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
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  const possiblePaths = [
    ...(isMac ? [path.join(__dirname, '../public/brand/icon.icns')] : []),
    ...(isWin ? [path.join(__dirname, '../public/brand/icon.ico')] : []),
    path.join(__dirname, '../public/brand/icon.ico'),
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

function setupApplicationMenu() {
  if (process.platform === 'darwin') {
    const template = [
      {
        label: 'RaagaX',
        submenu: [
          { role: 'about', label: 'About RaagaX Lossless Pro' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide', label: 'Hide RaagaX' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          {
            role: 'quit',
            label: 'Quit RaagaX',
            click: () => {
              isQuitting = true;
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'delete' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'Playback',
        submenu: [
          {
            label: 'Play / Pause',
            accelerator: 'Space',
            click: () => mainWindow?.webContents.send('media-key', 'TOGGLE_PLAY')
          },
          {
            label: 'Next Track',
            accelerator: 'CmdOrCtrl+Right',
            click: () => mainWindow?.webContents.send('media-key', 'NEXT')
          },
          {
            label: 'Previous Track',
            accelerator: 'CmdOrCtrl+Left',
            click: () => mainWindow?.webContents.send('media-key', 'PREV')
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        ]
      }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } else {
    Menu.setApplicationMenu(null);
  }
}

function setupProtocol() {
  protocol.handle('app', (request) => {
    const parsed = new URL(request.url);
    let pathname = decodeURIComponent(parsed.pathname);

    // Forward backend API calls directly to live RaagaX server
    if (pathname.startsWith('/api/') || pathname === '/api') {
      const backendUrl = `https://raaga.me${pathname}${parsed.search}`;
      const options = {
        method: request.method,
        headers: request.headers,
      };
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
        options.body = request.body;
      }
      return net.fetch(backendUrl, options).then((res) => {
        const headers = new Headers(res.headers);
        headers.set('access-control-allow-origin', '*');
        headers.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
        headers.set('access-control-allow-headers', '*');
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers,
        });
      }).catch((err) => {
        console.error('[Electron Protocol] API proxy error:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'access-control-allow-origin': '*' }
        });
      });
    }

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

  const windowConfig = {
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#060709',
    title: 'RaagaX Lossless Pro',
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    show: false,
  };

  if (process.platform === 'darwin') {
    // Elegant macOS styling with integrated traffic lights
    windowConfig.titleBarStyle = 'hiddenInset';
    windowConfig.trafficLightPosition = { x: 16, y: 14 };
  } else {
    // Windows custom titlebar overlay
    windowConfig.titleBarStyle = 'hidden';
    windowConfig.titleBarOverlay = {
      color: '#060709',
      symbolColor: '#FFFFFF',
      height: 38
    };
    windowConfig.autoHideMenuBar = true;
  }

  mainWindow = new BrowserWindow(windowConfig);

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
  setupApplicationMenu();
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


const { app, BrowserWindow, ipcMain, session, globalShortcut, Menu } = require("electron");
const path = require("path");
const http = require("http");
const net = require("net");
const fs = require("fs");
const { DiscordIPC } = require("./discord-ipc");

const discordRpc = new DiscordIPC();

// Safe chdir wrapper to prevent ENOTDIR crashes
const origChdir = process.chdir;
process.chdir = function (targetPath) {
  try {
    origChdir.call(process, targetPath);
  } catch (err) {
    console.warn("[Raaga Desktop] Handled chdir exception:", err.message);
  }
};

let mainWindow = null;
let nextServer = null;
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const DEFAULT_PORT = 3333;

// Official standard Google Chrome User-Agent to bypass Google 403 disallowed_useragent
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function waitForPort(port, host = "127.0.0.1", timeout = 12000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const client = new net.Socket();
      client.connect(port, host, () => {
        client.destroy();
        resolve(true);
      });
      client.on("error", () => {
        client.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for port ${port}`));
        } else {
          setTimeout(tryConnect, 150);
        }
      });
    }
    tryConnect();
  });
}

async function startProductionServer(port = DEFAULT_PORT) {
  // 1. Check for standalone server.js
  const standaloneServer = path.join(__dirname, "../.next/standalone/server.js");
  if (fs.existsSync(standaloneServer)) {
    process.env.PORT = String(port);
    process.env.HOSTNAME = "127.0.0.1";
    process.env.NODE_ENV = "production";

    // Ensure static assets are linked in standalone directory
    const standaloneStatic = path.join(__dirname, "../.next/standalone/.next/static");
    const originalStatic = path.join(__dirname, "../.next/static");
    if (!fs.existsSync(standaloneStatic) && fs.existsSync(originalStatic)) {
      try {
        fs.cpSync(originalStatic, standaloneStatic, { recursive: true });
      } catch (_) {}
    }
    const standalonePublic = path.join(__dirname, "../.next/standalone/public");
    const originalPublic = path.join(__dirname, "../public");
    if (!fs.existsSync(standalonePublic) && fs.existsSync(originalPublic)) {
      try {
        fs.cpSync(originalPublic, standalonePublic, { recursive: true });
      } catch (_) {}
    }

    require(standaloneServer);
    await waitForPort(port);
    console.log(`[Raaga Desktop] Standalone server ready on http://127.0.0.1:${port}`);
    return { close: () => {} };
  }

  // 2. Fallback to programmatic Next app
  const next = require("next");
  const appDir = path.join(__dirname, "..");
  const nextApp = next({ dev: false, dir: appDir });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => handle(req, res));
    server.listen(port, "127.0.0.1", () => {
      console.log(`[Raaga Desktop] Local production server listening on http://127.0.0.1:${port}`);
      resolve(server);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(startProductionServer(port + 1));
      } else {
        reject(err);
      }
    });
  });
}

async function createMainWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "Raaga",
    backgroundColor: "#0a0c14",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 16 },
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows cross-origin audio streaming and images
      backgroundThrottling: false, // Audio keeps playing uninterrupted in background
    },
  });

  mainWindow.webContents.setUserAgent(CHROME_USER_AGENT);

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.warn(`[Raaga Desktop] Waiting for local server... (${errorCode}: ${errorDescription})`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(serverUrl);
      }
    }, 800);
  });

  if (isDev) {
    const devUrl = process.env.DEV_URL || "http://localhost:3000";
    console.log(`[Raaga Desktop] Loading dev URL: ${devUrl}`);
    mainWindow.loadURL(devUrl).catch(() => {});
  } else {
    console.log(`[Raaga Desktop] Loading production URL: ${serverUrl}`);
    mainWindow.loadURL(serverUrl).catch(() => {});
  }

  // Register Global Media Shortcuts
  try {
    globalShortcut.register("MediaPlayPause", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("media:toggle-play");
      }
    });

    globalShortcut.register("MediaNextTrack", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("media:next");
      }
    });

    globalShortcut.register("MediaPreviousTrack", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("media:previous");
      }
    });
  } catch (err) {
    console.warn("Could not register media shortcuts:", err);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Firefox User-Agent to bypass Google 403 disallowed_useragent / "This browser or app may not be secure"
const GOOGLE_AUTH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";

// ---------------- Google / YouTube Auth Interceptor ----------------
ipcMain.handle("auth:google-login", async () => {
  return new Promise((resolve) => {
    const ses = session.fromPartition("persist:yt_session");
    ses.setUserAgent(GOOGLE_AUTH_USER_AGENT);

    // Override headers for Google and YouTube auth requests to remove all Chromium fingerprints
    ses.webRequest.onBeforeSendHeaders(
      { urls: ["*://*.google.com/*", "*://*.youtube.com/*"] },
      (details, callback) => {
        details.requestHeaders["User-Agent"] = GOOGLE_AUTH_USER_AGENT;
        delete details.requestHeaders["sec-ch-ua"];
        delete details.requestHeaders["sec-ch-ua-mobile"];
        delete details.requestHeaders["sec-ch-ua-platform"];
        delete details.requestHeaders["sec-ch-ua-platform-version"];
        delete details.requestHeaders["sec-ch-ua-full-version-list"];
        delete details.requestHeaders["sec-ch-ua-model"];
        delete details.requestHeaders["X-Electron"];
        delete details.requestHeaders["x-electron"];
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      }
    );

    const authWindow = new BrowserWindow({
      width: 520,
      height: 680,
      title: "Sign in to YouTube Music",
      parent: mainWindow,
      modal: true,
      show: true,
      backgroundColor: "#1e1e2e",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: "persist:yt_session",
        preload: path.join(__dirname, "auth-preload.js"),
      },
    });

    authWindow.webContents.setUserAgent(GOOGLE_AUTH_USER_AGENT);

    let resolved = false;

    const checkCookiesAndFinish = async () => {
      if (resolved) return;
      try {
        const ses = authWindow.webContents.session;
        const ytCookies = await ses.cookies.get({ domain: ".youtube.com" });
        const googleCookies = await ses.cookies.get({ domain: ".google.com" });
        const allCookies = [...ytCookies, ...googleCookies];

        // Deduplicate cookies
        const cookieMap = new Map();
        for (const c of allCookies) {
          if (!cookieMap.has(c.name)) {
            cookieMap.set(c.name, c.value);
          }
        }

        const hasAuth =
          cookieMap.has("SAPISID") ||
          cookieMap.has("LOGIN_INFO") ||
          cookieMap.has("__Secure-3PAPISID") ||
          cookieMap.has("SID");

        if (hasAuth) {
          resolved = true;
          const cookieString = Array.from(cookieMap.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");

          let accountName = "YouTube Music User";
          let accountEmail = undefined;
          try {
            const pageData = await authWindow.webContents.executeJavaScript(`
              (() => {
                try {
                  const avatar = document.querySelector('img#img')?.src;
                  const nameEl = document.querySelector('.ytd-account-item-renderer #entity-name') ||
                                 document.querySelector('[data-email]') ||
                                 document.querySelector('.gb_d');
                  return { name: nameEl ? (nameEl.innerText || nameEl.getAttribute('data-email')) : null, avatar };
                } catch(e) { return null; }
              })()
            `);
            if (pageData && pageData.name) {
              accountName = pageData.name;
            }
          } catch (_) {}

          setTimeout(() => {
            if (!authWindow.isDestroyed()) {
              authWindow.close();
            }
            resolve({
              success: true,
              cookie: cookieString,
              name: accountName,
              email: accountEmail,
            });
          }, 800);
        }
      } catch (err) {
        console.error("[Auth] Cookie check error:", err);
      }
    };

    authWindow.webContents.on("did-navigate", (event, url) => {
      if (!url.includes("ServiceLogin") && !url.includes("/signin/identifier")) {
        checkCookiesAndFinish();
      }
    });

    authWindow.webContents.on("did-navigate-in-page", (event, url) => {
      if (!url.includes("ServiceLogin") && !url.includes("/signin/identifier")) {
        checkCookiesAndFinish();
      }
    });

    // Check periodically in case Google finishes in the background without navigation
    const checkInterval = setInterval(() => {
      if (resolved || authWindow.isDestroyed()) {
        clearInterval(checkInterval);
        return;
      }
      checkCookiesAndFinish();
    }, 1500);

    authWindow.on("closed", () => {
      clearInterval(checkInterval);
      if (!resolved) {
        resolve({ success: false, error: "Login window closed before authentication completed" });
      }
    });

    authWindow.loadURL(
      "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F",
      { userAgent: GOOGLE_AUTH_USER_AGENT }
    );
  });
});

ipcMain.handle("auth:google-logout", async () => {
  try {
    const ses = session.fromPartition("persist:yt_session");
    await ses.clearStorageData({ storages: ["cookies"] });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Discord Rich Presence
ipcMain.on("discord:set-activity", (event, activity) => {
  try {
    discordRpc.setActivity(activity);
  } catch (err) {
    console.warn("[Discord RPC] Activity error:", err.message);
  }
});

ipcMain.on("discord:clear-activity", () => {
  try {
    discordRpc.clearActivity();
  } catch (err) {
    console.warn("[Discord RPC] Clear error:", err.message);
  }
});

// Window controls
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());

// App Lifecycle
app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    const template = [
      {
        label: "Raaga",
        submenu: [
          { role: "about", label: "About Raaga" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide", label: "Hide Raaga" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit", label: "Quit Raaga" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "Playback",
        submenu: [
          {
            label: "Play / Pause",
            accelerator: "Space",
            click: () => mainWindow?.webContents.send("media:toggle-play"),
          },
          {
            label: "Next Track",
            accelerator: "CmdOrCtrl+Right",
            click: () => mainWindow?.webContents.send("media:next"),
          },
          {
            label: "Previous Track",
            accelerator: "CmdOrCtrl+Left",
            click: () => mainWindow?.webContents.send("media:previous"),
          },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      {
        label: "Window",
        submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  let serverUrl = "http://127.0.0.1:3333";
  if (!isDev) {
    try {
      nextServer = await startProductionServer(DEFAULT_PORT);
      if (nextServer && nextServer.address && nextServer.address()) {
        serverUrl = `http://127.0.0.1:${nextServer.address().port}`;
      } else {
        serverUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
      }
    } catch (err) {
      console.error("[Raaga Desktop] Failed to start local server:", err);
    }
  }

  await createMainWindow(serverUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(serverUrl);
    }
  });
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  discordRpc.destroy();
  if (nextServer && nextServer.close) {
    nextServer.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

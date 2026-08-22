const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8080;
const rootDir = path.resolve(__dirname, '..');

// Find active LAN IPv4
function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const lanIp = getLanIp();

const apkCandidates = [
  path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  path.join(rootDir, 'public', 'RaagaX.apk'),
  path.join(rootDir, 'Raaga.apk'),
  path.join(rootDir, 'RaagaX.apk')
];

function getLatestApkPath() {
  for (const candidate of apkCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const apkPath = getLatestApkPath();
  const url = req.url || '/';

  if (url === '/RaagaX.apk' || url === '/Raaga.apk' || url === '/download') {
    if (!apkPath || !fs.existsSync(apkPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('APK not found. Please build the APK first.');
      return;
    }
    const stat = fs.statSync(apkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="RaagaX.apk"',
      'Access-Control-Allow-Origin': '*'
    });
    const stream = fs.createReadStream(apkPath);
    stream.pipe(res);
    console.log(`[STREAM SERVER] Streaming APK to client: ${req.socket.remoteAddress}`);
    return;
  }

  // Mobile Web Landing Page
  const stat = apkPath && fs.existsSync(apkPath) ? fs.statSync(apkPath) : null;
  const sizeMb = stat ? (stat.size / (1024 * 1024)).toFixed(1) : '16.5';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RaagaX APK Direct Stream</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #09090b;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 28px;
      padding: 32px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      backdrop-filter: blur(20px);
    }
    .badge {
      display: inline-block;
      background: rgba(250, 35, 59, 0.15);
      color: #fa233b;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 16px;
      border: 1px solid rgba(250, 35, 59, 0.3);
    }
    h1 {
      font-size: 24px;
      font-weight: 900;
      margin: 0 0 8px 0;
      letter-spacing: -0.5px;
    }
    p {
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: block;
      background: #fa233b;
      color: #fff;
      font-size: 15px;
      font-weight: 800;
      text-decoration: none;
      padding: 16px 20px;
      border-radius: 18px;
      box-shadow: 0 8px 25px rgba(250, 35, 59, 0.4);
      transition: all 0.2s;
    }
    .btn:active {
      transform: scale(0.96);
      background: #d91e32;
    }
    .info {
      margin-top: 20px;
      font-size: 11px;
      color: #64748b;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">LAN APK Stream</div>
    <h1>RaagaX Lossless Pro</h1>
    <p>Version 1.0.2 • Connect V2 Ready<br>Native ExoPlayer & Spotify-Grade LAN Connect</p>
    <a href="/RaagaX.apk" class="btn">⬇ Download APK (${sizeMb} MB)</a>
    <div class="info">Direct stream from: ${lanIp}:${PORT}</div>
  </div>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 RaagaX APK Streaming Server Active!`);
  console.log(`📱 Open this link on your phone:`);
  console.log(`👉 http://${lanIp}:${PORT}/`);
  console.log(`👉 Direct APK download: http://${lanIp}:${PORT}/RaagaX.apk`);
  console.log(`======================================================\n`);
});

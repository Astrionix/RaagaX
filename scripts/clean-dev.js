const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nextDir = path.join(rootDir, '.next');

const stashApiDir = path.join(rootDir, '.api_stash_apk');
const apiDir = path.join(rootDir, 'src', 'app', 'api');

const stashSitemapFile = path.join(rootDir, '.sitemap_stash_apk');
const sitemapFile = path.join(rootDir, 'src', 'app', 'sitemap.ts');

const stashRobotsFile = path.join(rootDir, '.robots_stash_apk');
const robotsFile = path.join(rootDir, 'src', 'app', 'robots.ts');

if (fs.existsSync(stashApiDir) && !fs.existsSync(apiDir)) {
  try {
    fs.renameSync(stashApiDir, apiDir);
    console.log('✅ [predev] Restored src/app/api from stash');
  } catch (e) {
    console.warn('⚠️ [predev] Could not restore src/app/api:', e.message);
  }
}
if (fs.existsSync(stashSitemapFile) && !fs.existsSync(sitemapFile)) {
  try { fs.renameSync(stashSitemapFile, sitemapFile); } catch {}
}
if (fs.existsSync(stashRobotsFile) && !fs.existsSync(robotsFile)) {
  try { fs.renameSync(stashRobotsFile, robotsFile); } catch {}
}

if (process.platform === 'win32') {
  try {
    execSync('powershell -NoProfile -Command "if (Test-Path .next) { Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue }"', { cwd: rootDir, stdio: 'ignore' });
  } catch {
    try {
      execSync('cmd.exe /c "if exist .next rmdir /s /q .next"', { cwd: rootDir, stdio: 'ignore' });
    } catch {}
  }
} else if (fs.existsSync(nextDir)) {
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
  } catch {}
}


/**
 * RaagaX APK App-Shell Static Export Builder
 *
 * Temporarily isolates server-side API route handlers, runs Next.js static
 * export to generate the complete local application shell into `out/`, and
 * restores the API route handlers.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'src', 'app', 'api');
const backupApiDir = path.join(rootDir, 'src', '.api-backup-temp');
const outDir = path.join(rootDir, 'out');

console.log('[EXPORT] Starting RaagaX local app-shell static export...');

let apiMoved = false;

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function removeDirFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeDirFiles(fullPath);
      try { fs.rmdirSync(fullPath); } catch {}
    } else {
      try { fs.unlinkSync(fullPath); } catch {}
    }
  }
}

try {
  // Step 1: Temporarily isolate server-only API routes during static export
  if (fs.existsSync(apiDir)) {
    console.log('[EXPORT] Isolating server API routes during static export...');
    if (fs.existsSync(backupApiDir)) {
      try { fs.rmSync(backupApiDir, { recursive: true, force: true }); } catch {}
    }
    copyDir(apiDir, backupApiDir);
    removeDirFiles(apiDir);
    apiMoved = true;
  }

  // Step 2: Clean previous export and .next-export directory if exists
  if (fs.existsSync(outDir)) {
    console.log('[EXPORT] Cleaning previous out/ directory...');
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
  }
  const nextBuildDir = path.join(rootDir, '.next-export');
  if (fs.existsSync(nextBuildDir)) {
    console.log('[EXPORT] Cleaning previous .next-export/ build directory...');
    try { fs.rmSync(nextBuildDir, { recursive: true, force: true }); } catch {}
  }

  // Step 3: Run Next.js build in static export mode
  console.log('[EXPORT] Running next build (STATIC_EXPORT=true)...');
  execSync('npx next build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      STATIC_EXPORT: 'true',
      NODE_ENV: 'production',
    },
  });

  // Step 4: Verify out/index.html was produced
  const indexPath = path.join(outDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`[EXPORT ERROR] out/index.html was not generated at: ${indexPath}`);
  }

  console.log(`[EXPORT SUCCESS] RaagaX static app shell successfully exported to: ${outDir}`);
} catch (err) {
  console.error('[EXPORT ERROR] Failed to export static app shell:', err);
  process.exitCode = 1;
} finally {
  // Step 5: Always restore server API routes
  if (apiMoved && fs.existsSync(backupApiDir)) {
    try {
      copyDir(backupApiDir, apiDir);
      try { fs.rmSync(backupApiDir, { recursive: true, force: true }); } catch {}
      console.log('[EXPORT] Restored server API routes to src/app/api.');
    } catch (restoreErr) {
      console.error('[EXPORT CRITICAL] Failed to restore src/app/api from backup:', restoreErr);
    }
  }
}

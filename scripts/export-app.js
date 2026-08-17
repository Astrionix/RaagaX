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

try {
  // Step 1: Temporarily isolate server-only API routes during static export
  if (fs.existsSync(apiDir)) {
    console.log('[EXPORT] Isolating server API routes during static export...');
    if (fs.existsSync(backupApiDir)) {
      fs.rmSync(backupApiDir, { recursive: true, force: true });
    }
    fs.renameSync(apiDir, backupApiDir);
    apiMoved = true;
  }

  // Step 2: Clean previous export directory if exists
  if (fs.existsSync(outDir)) {
    console.log('[EXPORT] Cleaning previous out/ directory...');
    fs.rmSync(outDir, { recursive: true, force: true });
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
      if (fs.existsSync(apiDir)) {
        fs.rmSync(apiDir, { recursive: true, force: true });
      }
      fs.renameSync(backupApiDir, apiDir);
      console.log('[EXPORT] Restored server API routes to src/app/api.');
    } catch (restoreErr) {
      console.error('[EXPORT CRITICAL] Failed to restore src/app/api from backup:', restoreErr);
    }
  }
}

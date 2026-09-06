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
const outDir = path.join(rootDir, 'out');

console.log('[EXPORT] Starting RaagaX local app-shell static export...');

function copyItem(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (typeof fs.cpSync === 'function') {
      fs.cpSync(src, dest, { recursive: true, force: true });
      return;
    }
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyItem(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

try {

  // Step 2: Clean previous out/ export directory and .next_apk_build directory
  if (fs.existsSync(outDir)) {
    console.log('[EXPORT] Cleaning previous out/ directory...');
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
  }
  const apkBuildDir = path.join(rootDir, '.next_apk_build');
  if (fs.existsSync(apkBuildDir)) {
    try { fs.rmSync(apkBuildDir, { recursive: true, force: true }); } catch {}
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

  // Step 4: Populate out/ directory from .next_export
  const exportSource = path.join(rootDir, '.next_export');
  if (fs.existsSync(exportSource)) {
    console.log('[EXPORT] Populating out/ directory from static build...');
    copyItem(exportSource, outDir);
  }

  // Verify out/index.html was produced
  const indexPath = path.join(outDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`[EXPORT ERROR] out/index.html was not generated at: ${indexPath}`);
  }

  // Step 4b: Clean up any symlink directories in out/ (e.g. out/404) that break Gradle asset merge
  const symlink404 = path.join(outDir, '404');
  if (fs.existsSync(symlink404)) {
    try { fs.rmSync(symlink404, { recursive: true, force: true }); } catch {}
  }

  console.log('✅ [EXPORT SUCCESS] RaagaX app-shell static export ready in out/');
} catch (err) {
  console.error('[EXPORT ERROR] Failed to export static app shell:', err);
  process.exit(1);
}

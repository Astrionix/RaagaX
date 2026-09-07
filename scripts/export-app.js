/**
 * RaagaX APK App-Shell Static Export Builder (Shadow Isolated Architecture)
 *
 * Builds the Next.js static export app-shell inside a temporary isolated
 * shadow workspace (`.apk_app_build`), preserving `src/app/api`, `.next`, and
 * the active `npm run dev` server in the main workspace completely undisturbed.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'out');
const shadowDir = path.join(rootDir, '.apk_app_build');

console.log('[EXPORT] Starting RaagaX local app-shell static export (Shadow Isolated Build)...');

// Clean previous shadow build dir & main out dir
if (fs.existsSync(shadowDir)) {
  try { fs.rmSync(shadowDir, { recursive: true, force: true }); } catch {}
}
if (fs.existsSync(outDir)) {
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
}

fs.mkdirSync(shadowDir, { recursive: true });

function copyFolderFiltered(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Exclude src/app/api and src/app/releases route handlers from static export shadow tree
      if ((entry.name === 'api' || entry.name === 'releases') && srcPath.includes(path.join('src', 'app'))) {
        continue;
      }
      copyFolderFiltered(srcPath, destPath);
    } else {
      // Exclude sitemap.ts, robots.ts, and route.ts files from static export shadow tree
      if ((entry.name === 'sitemap.ts' || entry.name === 'robots.ts' || entry.name === 'route.ts' || entry.name === 'route.js') && srcPath.includes(path.join('src', 'app'))) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy src/ into shadow directory (excluding api, sitemap, robots)
console.log('[EXPORT] Copying isolated shadow source tree...');
copyFolderFiltered(path.join(rootDir, 'src'), path.join(shadowDir, 'src'));

// 2. Copy configuration files into shadow directory
const filesToCopy = [
  'package.json',
  'next.config.mjs',
  'tsconfig.json',
  'tailwind.config.js',
  'postcss.config.mjs',
];
for (const file of filesToCopy) {
  const srcFile = path.join(rootDir, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, path.join(shadowDir, file));
  }
}

// 3. Symlink node_modules and public for instant speed
try {
  fs.symlinkSync(path.join(rootDir, 'node_modules'), path.join(shadowDir, 'node_modules'), 'dir');
} catch (e) {
  copyFolderFiltered(path.join(rootDir, 'node_modules'), path.join(shadowDir, 'node_modules'));
}

if (fs.existsSync(path.join(rootDir, 'public'))) {
  try {
    fs.symlinkSync(path.join(rootDir, 'public'), path.join(shadowDir, 'public'), 'dir');
  } catch (e) {
    copyFolderFiltered(path.join(rootDir, 'public'), path.join(shadowDir, 'public'));
  }
}

// 4. Run Next.js build inside shadow directory
console.log('[EXPORT] Running next build in isolated shadow environment (STATIC_EXPORT=true)...');
try {
  execSync('npx next build', {
    cwd: shadowDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      STATIC_EXPORT: 'true',
      NODE_ENV: 'production',
    },
  });

  // 5. Copy exported out directory back to main outDir
  const shadowOutDir = path.join(shadowDir, 'out');
  const shadowExportSource = fs.existsSync(shadowOutDir)
    ? shadowOutDir
    : (fs.existsSync(path.join(shadowDir, '.next_apk_build'))
        ? path.join(shadowDir, '.next_apk_build')
        : path.join(shadowDir, '.next_export'));

  if (fs.existsSync(shadowExportSource)) {
    console.log('[EXPORT] Copying app-shell output to out/...');
    if (typeof fs.cpSync === 'function') {
      fs.cpSync(shadowExportSource, outDir, { recursive: true, force: true });
    } else {
      copyFolderFiltered(shadowExportSource, outDir);
    }
  }

  const indexPath = path.join(outDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`[EXPORT ERROR] out/index.html was not generated at: ${indexPath}`);
  }

  // Prune heavy releases binaries (DMGs, EXEs) from exported out/ directory
  const outReleases = path.join(outDir, 'releases');
  if (fs.existsSync(outReleases)) {
    try {
      fs.rmSync(outReleases, { recursive: true, force: true });
      console.log('[EXPORT] Pruned out/releases heavy binaries to keep APK bundle light.');
    } catch (e) {}
  }

  console.log('✅ [EXPORT SUCCESS] RaagaX app-shell static export ready in out/');
} catch (err) {
  console.error('[EXPORT ERROR] Failed to export static app shell:', err);
  process.exit(1);
} finally {
  // Clean up shadow directory
  if (fs.existsSync(shadowDir)) {
    try { fs.rmSync(shadowDir, { recursive: true, force: true }); } catch {}
  }
}

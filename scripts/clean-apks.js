const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const targets = [
  path.join(rootDir, 'public', 'RaagaX.apk'),
  path.join(rootDir, 'out', 'RaagaX.apk'),
  path.join(rootDir, 'Raaga.apk'),
  path.join(rootDir, 'Raaga-debug.apk'),
  path.join(rootDir, 'RaagaX.apk'),
  path.join(rootDir, 'RaagaX-debug.apk'),
  path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'RaagaX.apk'),
  path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'Raaga.apk')
];

console.log('[Clean APKs] Starting cleanup to avoid recursive APK packaging...');

targets.forEach((filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Clean APKs] Deleted: ${filePath}`);
    }
  } catch (err) {
    console.warn(`[Clean APKs] Failed to delete ${filePath}:`, err.message);
  }
});

// Also search and delete any heavy binaries (.apk, .dmg, .exe, .zip) recursively in public, out, or assets
const purgeHeavyBinaries = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        purgeHeavyBinaries(fullPath);
      }
    } else if (file.endsWith('.apk') || file.endsWith('.dmg') || file.endsWith('.exe') || file.endsWith('.zip')) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`[Clean APKs] Purged binary asset: ${fullPath}`);
      } catch (err) {
        console.warn(`[Clean APKs] Failed to purge ${fullPath}:`, err.message);
      }
    }
  });
};

purgeHeavyBinaries(path.join(rootDir, 'public', 'RaagaX.apk'));
purgeHeavyBinaries(path.join(rootDir, 'out'));
purgeHeavyBinaries(path.join(rootDir, 'android', 'app', 'src', 'main', 'assets'));

console.log('[Clean APKs] Cleanup completed successfully!');

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

// Also search and delete any other .apk files recursively in public, out, or assets
const deleteApkRecursively = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Don't traverse node_modules, .git, or .next
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        deleteApkRecursively(fullPath);
      }
    } else if (file.endsWith('.apk')) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`[Clean APKs] Cleaned wildcard APK: ${fullPath}`);
      } catch (err) {
        console.warn(`[Clean APKs] Failed to delete wildcard APK ${fullPath}:`, err.message);
      }
    }
  });
};

deleteApkRecursively(path.join(rootDir, 'public'));
deleteApkRecursively(path.join(rootDir, 'out'));
deleteApkRecursively(path.join(rootDir, 'android', 'app', 'src', 'main', 'assets'));

console.log('[Clean APKs] Cleanup completed successfully!');

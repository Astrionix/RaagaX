const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Clean previous build artifacts
require('./clean-build.js');

// 2. Apply standalone patch
require('./patch-next-standalone.js');

// 3. Run OpenNext with recursive guard
console.log('[OpenNext] Starting OpenNext Cloudflare build...');
execSync('npx @opennextjs/cloudflare build --dangerouslyUseUnsupportedNextVersion', {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    __OPEN_NEXT_BUILD__: '1',
  },
});

const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const isCloudflare = Boolean(
  process.env.CF_PAGES ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.CF_PAGES_BRANCH ||
  process.env.CLOUDFLARE_ENV ||
  process.env.WORKERS_CI
);

const isInsideOpenNext = Boolean(process.env.__OPEN_NEXT_BUILD__);

if (isInsideOpenNext) {
  console.log('[Build] Inside OpenNext context — running Next.js build...');
  execSync('npx next build', { cwd: rootDir, stdio: 'inherit', env: process.env });
} else if (isCloudflare) {
  console.log('[Build] Cloudflare CI detected — running OpenNext build...');
  require('./clean-build.js');
  require('./patch-next-standalone.js');
  execSync('npx @opennextjs/cloudflare build --dangerouslyUseUnsupportedNextVersion', {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      __OPEN_NEXT_BUILD__: '1',
    },
  });
} else {
  console.log('[Build] Standard environment (CI / Local) — running Next.js build...');
  execSync('npx next build', { cwd: rootDir, stdio: 'inherit', env: process.env });
}

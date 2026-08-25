const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nextDir = path.join(rootDir, '.next');

if (process.platform === 'win32') {
  try {
    execSync('cmd.exe /c "if exist .next rmdir /s /q .next"', { cwd: rootDir, stdio: 'ignore' });
  } catch {}
} else if (fs.existsSync(nextDir)) {
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
  } catch {}
}

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const dirsToClean = ['.next', '.open-next', '.next_export'];

for (const dir of dirsToClean) {
  const fullPath = path.join(rootDir, dir);
  if (process.platform === 'win32') {
    try {
      execSync(`cmd.exe /c "if exist ${dir} rmdir /s /q ${dir}"`, { cwd: rootDir, stdio: 'ignore' });
    } catch {}
  } else if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } catch {}
  }
}

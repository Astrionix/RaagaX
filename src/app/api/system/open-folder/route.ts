import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const targetFolder = path.join(os.homedir(), 'Downloads', 'RaagaX');
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const platform = process.platform;
    if (platform === 'win32') {
      exec(`explorer.exe "${targetFolder}"`);
    } else if (platform === 'darwin') {
      exec(`open "${targetFolder}"`);
    } else {
      exec(`xdg-open "${targetFolder}"`);
    }

    return NextResponse.json({
      success: true,
      folder: targetFolder,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

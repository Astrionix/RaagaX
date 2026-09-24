import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let filename = '';
    let buffer: Buffer | null = null;

    let subfolder = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      filename = (formData.get('filename') as string) || (file ? file.name : '');
      subfolder = (formData.get('subfolder') as string) || '';
      if (file) {
        const arrayBuf = await file.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
      }
    } else {
      const body = await req.json();
      filename = body.filename || 'song.mp3';
      subfolder = body.subfolder || '';
      if (body.base64) {
        buffer = Buffer.from(body.base64, 'base64');
      }
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ success: false, error: 'No audio data received' }, { status: 400 });
    }

    // Sanitize filename & subfolder
    const safeFilename = filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || `song_${Date.now()}.mp3`;
    // Dedicated RaagaX folder in user's Downloads directory (flat direct file storage)
    const targetFolder = path.join(os.homedir(), 'Downloads', 'RaagaX');
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const filePath = path.join(targetFolder, safeFilename);
    fs.writeFileSync(filePath, buffer);

    console.log(`[SaveSongAPI] Successfully saved offline song to: ${filePath} (${buffer.length} bytes)`);

    return NextResponse.json({
      success: true,
      folder: targetFolder,
      path: filePath,
      filename: safeFilename,
      bytes: buffer.length,
    });
  } catch (err: any) {
    console.error('[SaveSongAPI] Failed to save song to disk:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to save to disk' }, { status: 500 });
  }
}

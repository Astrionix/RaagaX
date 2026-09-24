import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync(process.cwd());
      const totalBytes = Number(s.bsize) * Number(s.blocks);
      const availableBytes = Number(s.bsize) * Number(s.bavail);
      const usedBytes = totalBytes - availableBytes;

      return NextResponse.json({
        success: true,
        totalBytes,
        availableBytes,
        usedBytes,
      });
    }
  } catch (err: any) {
    console.warn('[SystemStorageAPI] Could not query disk stats:', err?.message);
  }

  return NextResponse.json({ success: false }, { status: 200 });
}

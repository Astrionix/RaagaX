import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Try to find the version-specific APK first
    let filePath = path.join(process.cwd(), 'public/releases/RaagaX-1.1.0.apk');
    let fileName = 'RaagaX-1.1.0.apk';

    if (!fs.existsSync(filePath)) {
      // Fallback to a generic latest release path if version-specific doesn't exist
      filePath = path.join(process.cwd(), 'public/releases/RaagaX-latest.apk');
      fileName = 'RaagaX-latest.apk';
    }

    if (!fs.existsSync(filePath)) {
      return new NextResponse('APK update file not found on server.', { status: 404 });
    }

    const fileStream = fs.createReadStream(filePath);
    const stat = fs.statSync(filePath);

    // Stream the binary data with correct Android package headers
    return new NextResponse(fileStream as any, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (e: any) {
    console.error('[APK Stream API] Failed to serve update APK:', e);
    return new NextResponse('Internal server error streaming APK file.', { status: 500 });
  }
}

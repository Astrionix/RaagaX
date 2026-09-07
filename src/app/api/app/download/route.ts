import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Try to find the latest release APK in public/releases or root via Node fs
    let filePath = path.join(process.cwd(), 'public/releases/RaagaX-latest.apk');
    let fileName = 'RaagaX-latest.apk';

    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public/RaagaX.apk');
      fileName = 'RaagaX.apk';
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'RaagaX.apk');
      fileName = 'RaagaX.apk';
    }

    if (fs.existsSync(filePath)) {
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
    }
  } catch (e: any) {
    console.warn('[APK Stream API] Node fs check unavailable, redirecting to Cloudflare asset URL:', e?.message);
  }

  // Edge / Cloudflare Workers environment fallback: redirect to static Cloudflare Asset
  const assetUrl = new URL('/releases/RaagaX-latest.apk', request.url);
  return NextResponse.redirect(assetUrl, 302);
}


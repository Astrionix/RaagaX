import { NextResponse } from 'next/server';
import latestManifest from '../../../../../public/releases/latest.json';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apkPath = path.join(process.cwd(), 'public/releases/RaagaX-latest.apk');
    let dynamicSha256 = latestManifest?.sha256;
    let dynamicFileSize = latestManifest?.fileSize;

    if (fs.existsSync(apkPath)) {
      const stat = fs.statSync(apkPath);
      dynamicFileSize = stat.size;
      const fileBuffer = fs.readFileSync(apkPath);
      dynamicSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    }

    return NextResponse.json({
      ...latestManifest,
      sha256: dynamicSha256 || 'b8ad079b36c2d6df924486ebb6bce0656622ff6ad01e138534a3f308212bbcb0',
      fileSize: dynamicFileSize || 13251382,
    });
  } catch (e) {
    console.error('Failed to compute dynamic APK manifest:', e);
  }

  // Fallback to latest stable release manifest
  return NextResponse.json({
    versionCode: 14,
    versionName: "1.3.0",
    apkUrl: "https://raaga.me/api/app/download",
    sha256: "b8ad079b36c2d6df924486ebb6bce0656622ff6ad01e138534a3f308212bbcb0",
    fileSize: 13251382,
    releaseDate: "2026-09-08",
    mandatory: false,
    minimumSupportedVersion: 1,
    releaseChannel: "stable",
    releaseNotes: [
      "New: Karaoke & Synced Lyrics mode on Mobile & Desktop floating player.",
      "New: Friends Activity Feed & Single Blend Hub moved directly into Library view.",
      "New: Active Friend Song Marquee Ticker on Home screen.",
      "Performance and stability enhancements for Android."
    ]
  });
}

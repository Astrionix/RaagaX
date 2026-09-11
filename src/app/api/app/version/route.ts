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
    versionName: "1.3.1",
    apkUrl: "https://raaga.me/api/app/download",
    sha256: "39e7a5a9a66e547ba8bb0a476a963c7bf552ae18ad2777a448611a347775816b",
    fileSize: 18270075,
    releaseDate: "2026-09-11",
    mandatory: false,
    minimumSupportedVersion: 1,
    releaseChannel: "stable",
    releaseNotes: [
      "Enhanced Playlists Cloud Sync: Seamless multi-device & offline auto-sync to Supabase cloud.",
      "Fixed section header typography & contrast in light and dark themes.",
      "Performance, loss-less audio engine & UI response optimizations."
    ]
  });
}

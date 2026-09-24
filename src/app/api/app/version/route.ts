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
      sha256: dynamicSha256 || latestManifest?.sha256 || '5c6c2f5a7c71c7fe8b73cf00b36863e15b82b36baf0e79a71e9d46c04a391156',
      fileSize: dynamicFileSize || latestManifest?.fileSize || 19935109,
    });
  } catch (e) {
    console.error('Failed to compute dynamic APK manifest:', e);
  }

  // Fallback to latest stable release manifest (from imported latest.json or v1.4.0 defaults)
  return NextResponse.json(latestManifest || {
    versionCode: 17,
    versionName: "1.4.0",
    apkUrl: "https://raaga.me/api/app/download",
    sha256: "5c6c2f5a7c71c7fe8b73cf00b36863e15b82b36baf0e79a71e9d46c04a391156",
    fileSize: 19935109,
    releaseDate: "2026-09-24",
    mandatory: false,
    minimumSupportedVersion: 1,
    releaseChannel: "stable",
    releaseNotes: [
      "Account Isolation & Security: Atomic session guard with strict multi-user logout purge, realtime isolation, and switch-user state protection.",
      "Onboarding Fix: Continue button now always reachable when 2+ languages selected during registration.",
      "Artist Picker Redesign: Premium cinematic square cards with photo, gradient fallback, glow selection ring and staggered animation.",
      "Background ZIP Export: Click ZIP once and it runs in background with floating progress card and download prompt.",
      "UI Polish: Compact 3-column artist grid, live selection counter badge and smarter Continue button state."
    ]
  });
}

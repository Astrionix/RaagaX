import { NextResponse } from 'next/server';
import latestManifest from '../../../../../public/releases/latest.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (latestManifest && latestManifest.versionCode) {
      return NextResponse.json(latestManifest);
    }
  } catch (e) {
    console.error('Failed to return latest release manifest:', e);
  }

  // Fallback to latest stable release manifest
  return NextResponse.json({
    versionCode: 13,
    versionName: "1.2.9",
    apkUrl: "https://raaga.me/api/app/download",
    sha256: "skip",
    fileSize: 13537812,
    releaseDate: "2026-09-08",
    mandatory: true,
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


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

  // Fallback to latest stable release manifest (versionCode 8 - v1.2.4)
  return NextResponse.json({
    versionCode: 8,
    versionName: "1.2.4",
    apkUrl: "https://raaga.me/api/app/download",
    sha256: "84bf379125f32ce9d3b54efbd73be30a71526a9b98109560e472ff49219aee76",
    fileSize: 13233996,
    releaseDate: "2026-09-07",
    mandatory: false,
    minimumSupportedVersion: 1,
    releaseChannel: "stable",
    releaseNotes: [
      "Fixed Jam Session playback in APK: guests seamlessly stream and play host Jam songs.",
      "Fixed stale playbar song audio lingering when joining Jam sessions.",
      "Seamless Android Lock Screen & Notification Shade sync for Jam & Connect.",
      "Real-time song title, artist, artwork, position & duration sync on Lock Screen.",
      "Lossless playback engine and performance enhancements."
    ]
  });
}


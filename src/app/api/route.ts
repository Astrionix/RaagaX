import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This API endpoint serves as the central source of truth for your APK versioning.
// When you release a new APK, update the 'latestVersion' string here.
export async function GET() {
  return NextResponse.json({
    latestVersion: '1.0.2',
    downloadUrl: '/RaagaX.apk',
    releaseNotes: 'RaagaX Connect V2: Full Spotify-grade LAN Connect with atomic track sync, shared seek control, and non-interruptive disconnect.',
    forceUpdate: false
  });
}

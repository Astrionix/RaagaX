import { NextResponse } from 'next/server';

// This API endpoint serves as the central source of truth for your APK versioning.
// When you release a new APK, update the 'latestVersion' string here.
export async function GET() {
  return NextResponse.json({
    latestVersion: '1.0.1', // Update this when you release a new version
    downloadUrl: '/RaagaX.apk', // Ensure this file exists in your public/ folder
    releaseNotes: 'Performance improvements and cross-device sync fixes.',
    forceUpdate: false // Set to true to prevent closing the update modal
  });
}

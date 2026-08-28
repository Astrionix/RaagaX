import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public/releases/latest.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return NextResponse.json(JSON.parse(data));
    }
  } catch (e) {
    console.error('Failed to read latest release manifest:', e);
  }

  // Fallback to static default manifest if file is not found (e.g. dev server startup)
  return NextResponse.json({
    versionCode: 2,
    versionName: "1.1.0",
    apkUrl: "/api/app/download",
    sha256: "80b07843d60eb800b3db92593511d8314874c7d888d779f7bb9b9b0425c6ca48",
    fileSize: 13247156,
    releaseDate: "2026-08-28",
    mandatory: false,
    minimumSupportedVersion: 1,
    releaseChannel: "stable",
    releaseNotes: [
      "Added real-time Search & Sort in Liked Songs, History, and Downloaded Music.",
      "Added direct Download button beside Shuffle in Liked Songs for mobile.",
      "Accurate lyricist & songwriter credits across all playback views.",
      "Reliable spacebar Play/Pause keyboard shortcut engine.",
      "High-fidelity lossless audio playback and memory optimizations."
    ]
  });
}

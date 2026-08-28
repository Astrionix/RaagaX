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
    versionCode: 1,
    versionName: "1.0.0",
    apkUrl: "https://raagax-releases.s3.amazonaws.com/apks/RaagaX-1.0.0.apk",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    fileSize: 13228251,
    releaseDate: "2026-08-26",
    mandatory: false,
    minimumSupportedVersion: 1,
    releaseChannel: "stable",
    releaseNotes: [
      "Initial production release.",
      "Lossless music streaming engine."
    ]
  });
}

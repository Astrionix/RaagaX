import { NextResponse } from 'next/server';

const RELEASE_BASE = 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0';

const RELEASE_REDIRECT_MAP: Record<string, string> = {
  'RaagaX-Windows-Universal.exe': `${RELEASE_BASE}/RaagaX-Windows-Universal.exe`,
  'RaagaX-Windows-Portable.exe': `${RELEASE_BASE}/RaagaX-Windows-Portable.exe`,
  'RaagaX-macOS-Universal.dmg': `${RELEASE_BASE}/RaagaX-macOS-Universal.dmg`,
  'RaagaX-macOS-arm64.dmg': `${RELEASE_BASE}/RaagaX-macOS-Universal.dmg`,
  'RaagaX-macOS-intel.dmg': `${RELEASE_BASE}/RaagaX-macOS-Universal.dmg`,
  'RaagaX-latest.apk': `${RELEASE_BASE}/RaagaX.apk`,
  'RaagaX.apk': `${RELEASE_BASE}/RaagaX.apk`,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const target = RELEASE_REDIRECT_MAP[filename] || `${RELEASE_BASE}/${filename}`;
  return NextResponse.redirect(target, 302);
}

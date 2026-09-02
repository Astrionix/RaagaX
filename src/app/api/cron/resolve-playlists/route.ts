import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Resolve-playlists cron completed (lean mode)',
    timestamp: new Date().toISOString()
  });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const now = Date.now();
  return NextResponse.json({
    serverTimeMs: now,
    serverTime: now,
    timestamp: new Date(now).toISOString(),
  });
}

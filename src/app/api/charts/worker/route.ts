import { NextRequest, NextResponse } from 'next/server';
import { DiscoveryEngine, DiscoveryLanguage } from '@/lib/discoveryEngine';

export const maxDuration = 60; // 60 seconds max duration for Vercel

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3001';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const language = (body.language || 'Telugu') as DiscoveryLanguage;

    const engine = DiscoveryEngine.getInstance(getBaseUrl(req));
    
    // Fire and forget - Next.js App Router doesn't always support true fire-and-forget 
    // unless running on Edge/Vercel with waitUntil, but we'll try to await it here since 
    // this is a dedicated worker endpoint called by the main API route.
    const result = await engine.discover(language);

    return NextResponse.json({ success: true, language, status: result.status });
  } catch (err) {
    console.error('[CHART WORKER ERROR]', err);
    return NextResponse.json({ success: false, error: 'Worker failed' }, { status: 500 });
  }
}

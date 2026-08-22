import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const services: Record<string, { status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs: number; error?: string }> = {};

  // 1. Check Supabase Database connectivity
  try {
    const dbStart = Date.now();
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    services.database = {
      status: error ? 'degraded' : 'healthy',
      latencyMs: Date.now() - dbStart,
      ...(error ? { error: error.message } : {})
    };
  } catch (e: any) {
    services.database = {
      status: 'unhealthy',
      latencyMs: Date.now() - startTime,
      error: e.message || 'Database connection failed'
    };
  }

  // 2. Check Music Engine Provider API connectivity (JioSaavn ping)
  try {
    const apiStart = Date.now();
    const res = await fetch('https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&q=telugu&p=1&n=1', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 }
    });
    services.musicEngine = {
      status: res.ok ? 'healthy' : 'degraded',
      latencyMs: Date.now() - apiStart,
      ...(!res.ok ? { error: `HTTP ${res.status}` } : {})
    };
  } catch (e: any) {
    services.musicEngine = {
      status: 'degraded',
      latencyMs: Date.now() - startTime,
      error: e.message || 'Music provider fetch failed'
    };
  }

  const isHealthy = Object.values(services).every(s => s.status === 'healthy');

  return NextResponse.json({
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - startTime,
    services
  }, { status: isHealthy ? 200 : 270 });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export interface ListeningEventPayload {
  trackId: string;
  eventType: 'START' | 'COMPLETE' | 'SKIP' | 'REPLAY' | 'LIKE' | 'UNLIKE' | 'PLAY_PROGRESS';
  positionMs?: number;
  durationMs?: number;
  artistId?: string;
  artistName?: string;
  language?: string;
  genre?: string;
  timestamp?: number;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data } = await supabaseAdmin.auth.getUser(token);
      userId = data?.user?.id || null;
    }

    const body = await req.json();
    const events: ListeningEventPayload[] = Array.isArray(body.events) ? body.events : (body ? [body] : []);

    if (events.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    // Filter meaningful events to avoid noise
    const validEvents = events.filter(e => e.trackId && e.eventType);

    return NextResponse.json({
      success: true,
      processed: events.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking failure: preference ingestion error must never impact client
    return NextResponse.json({ success: false, error: 'Event processing skipped' }, { status: 200 });
  }
}

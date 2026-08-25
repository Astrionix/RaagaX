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

    if (validEvents.length > 0 && userId) {
      // Ingest into durable listening_events table
      const rows = validEvents.map(e => ({
        user_id: userId,
        track_id: e.trackId,
        event_type: e.eventType,
        position_ms: e.positionMs || 0,
        duration_ms: e.durationMs || 0,
        created_at: new Date(e.timestamp || Date.now()).toISOString(),
      }));

      try {
        await supabaseAdmin.from('listening_events').insert(rows);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      processed: validEvents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking failure: preference ingestion error must never impact client
    return NextResponse.json({ success: false, error: 'Event processing skipped' }, { status: 200 });
  }
}

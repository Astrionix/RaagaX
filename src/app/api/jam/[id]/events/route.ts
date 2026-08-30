import { NextRequest } from 'next/server';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamEvent } from '@/types/jam';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jamId = params.id;
    const engine = JamServerEngine.getInstance();
    const session = engine.getSession(jamId);

    if (!session) {
      return new Response(JSON.stringify({ error: 'Jam session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();

    const customReadable = new ReadableStream({
      start(controller) {
        let isClosed = false;

        // 1. Send initial full snapshot event
        const initialEvent: JamEvent = {
          eventId: `EV_INIT_${Date.now()}`,
          jamId,
          type: 'SYNC',
          revision: session.revision,
          serverTimestamp: Date.now(),
          senderId: 'SYSTEM',
          payload: { session },
        };

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`));
        } catch {
          isClosed = true;
        }

        // 2. Subscribe to new live events
        const unsubscribe = engine.subscribeToSession(jamId, (event: JamEvent) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            isClosed = true;
            unsubscribe();
          }
        });

        // 3. Heartbeat every 15s to keep connection alive
        const heartbeat = setInterval(() => {
          if (isClosed) {
            clearInterval(heartbeat);
            return;
          }
          try {
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          } catch {
            isClosed = true;
            clearInterval(heartbeat);
            unsubscribe();
          }
        }, 15000);

        req.signal.addEventListener('abort', () => {
          isClosed = true;
          clearInterval(heartbeat);
          unsubscribe();
        });
      },
      cancel() {
        // Stream cancelled
      },
    });

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'SSE initialization error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

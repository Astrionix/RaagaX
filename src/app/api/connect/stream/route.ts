import { NextRequest } from 'next/server';
import { ConnectDeviceRegistry } from '@/lib/connect/ConnectDeviceRegistry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/connect/stream?deviceId=...
 *
 * Real-time Server-Sent Events (SSE) stream for sub-50ms command and state propagation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId');

  if (!deviceId) {
    return new Response('Missing deviceId parameter', { status: 400 });
  }

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial ping to open the stream
  writer.write(encoder.encode(`event: connected\ndata: ${JSON.stringify({ deviceId, timestamp: Date.now() })}\n\n`));

  // Subscribe to real-time events for this device
  const unsubscribe = ConnectDeviceRegistry.subscribeStream(deviceId, ({ type, payload }) => {
    try {
      const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
      writer.write(encoder.encode(message));
    } catch {
      // Client closed connection
    }
  });

  // Keep-alive heartbeat interval every 15s
  const pingInterval = setInterval(() => {
    try {
      writer.write(encoder.encode(`: ping\n\n`));
    } catch {
      clearInterval(pingInterval);
      unsubscribe();
    }
  }, 15000);

  request.signal.addEventListener('abort', () => {
    clearInterval(pingInterval);
    unsubscribe();
    writer.close().catch(() => {});
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

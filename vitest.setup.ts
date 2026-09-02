process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Ensure WebSocket global is available for Supabase Realtime in test environments
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    (globalThis as any).WebSocket = require('ws');
  } catch {}
}

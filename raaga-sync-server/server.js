/**
 * RaagaX Dedicated Stateful WebSocket Coordinator (for Render.com / Railway)
 *
 * Provides shared in-memory rooms and device presence for:
 * 1. Jam Sessions (Multi-user synchronized listening)
 * 2. RaagaX Connect (Cross-device remote control, mobile-to-desktop, desktop-to-desktop)
 *
 * 100% Free Tier Compatible with automatic sleep prevention.
 */

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;

// ============================================================================
// 1. HTTP Server for Health Checks, Webhook Pings, and Render Keep-Alive
// ============================================================================
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'active',
      service: 'RaagaX WebSocket Coordinator',
      connectedClients: wss.clients.size,
      activeRooms: rooms.size,
      activeDevices: devices.size,
      uptime: Math.floor(process.uptime()),
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server });

// ============================================================================
// 2. Stateful Registries in Shared Node.js Memory
// ============================================================================

// Jam Rooms: roomId -> { clients: Set<WebSocket>, state: any, hostDeviceId: string }
const rooms = new Map();

// Connect Devices: deviceId -> { ws: WebSocket, device: any, lastSeen: number }
const devices = new Map();

// Reverse lookup: ws -> { deviceId, roomId }
const socketMetadata = new WeakMap();

// Broadcast device list to all devices on the same subnet or account
function broadcastDeviceList(targetSubnet, targetAccountId) {
  const allActive = [];
  const now = Date.now();

  for (const [id, record] of devices.entries()) {
    if (now - record.lastSeen < 30000) {
      allActive.push(record.device);
    } else {
      devices.delete(id);
    }
  }

  for (const [id, record] of devices.entries()) {
    if (record.ws && record.ws.readyState === WebSocket.OPEN) {
      const dev = record.device;
      const sameAccount = Boolean(targetAccountId && dev.accountId && targetAccountId === dev.accountId);
      const sameSubnet = Boolean(!targetSubnet || !dev.subnet || targetSubnet === dev.subnet || dev.subnet === '127.0.0');

      if (sameAccount || sameSubnet) {
        record.ws.send(JSON.stringify({
          type: 'DEVICE_LIST_UPDATED',
          devices: allActive.filter((d) => d.deviceId !== id),
        }));
      }
    }
  }
}

// ============================================================================
// 3. WebSocket Connection Handling
// ============================================================================
wss.on('connection', (ws, req) => {
  const meta = { deviceId: null, roomId: null };
  socketMetadata.set(ws, meta);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (!data || !data.type) return;

      // ----------------------------------------------------------------------
      // A. JAM SESSION EVENTS
      // ----------------------------------------------------------------------
      if (data.type === 'JOIN_ROOM') {
        const { roomId, deviceId, isHost } = data;
        if (!roomId) return;

        meta.roomId = roomId;
        meta.deviceId = deviceId;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            clients: new Set(),
            state: null,
            hostDeviceId: deviceId || null,
          });
        }

        const room = rooms.get(roomId);
        room.clients.add(ws);

        if (isHost && deviceId) {
          room.hostDeviceId = deviceId;
        }

        console.log(`[Jam] Device "${deviceId || 'anonymous'}" joined room: ${roomId} (Total: ${room.clients.size})`);

        // Send current authoritative playback state immediately if available
        if (room.state) {
          ws.send(JSON.stringify({
            type: 'STATE_UPDATED',
            payload: room.state,
          }));
        }

        // Notify room members of participant join
        const joinNotice = JSON.stringify({
          type: 'PARTICIPANT_JOINED',
          deviceId,
          count: room.clients.size,
        });
        for (const client of room.clients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(joinNotice);
          }
        }
        return;
      }

      if (data.type === 'BROADCAST_STATE' || data.type === 'ROOM_BROADCAST') {
        const roomId = meta.roomId || data.roomId;
        if (!roomId || !rooms.has(roomId)) return;

        const room = rooms.get(roomId);
        room.state = data.payload;

        const payloadStr = JSON.stringify({
          type: 'STATE_UPDATED',
          payload: data.payload,
        });

        for (const client of room.clients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(payloadStr);
          }
        }
        return;
      }

      if (data.type === 'LEAVE_ROOM') {
        const roomId = meta.roomId || data.roomId;
        if (roomId && rooms.has(roomId)) {
          const room = rooms.get(roomId);
          room.clients.delete(ws);
          meta.roomId = null;

          if (room.clients.size === 0) {
            rooms.delete(roomId);
          } else {
            const leaveNotice = JSON.stringify({
              type: 'PARTICIPANT_LEFT',
              deviceId: meta.deviceId,
              count: room.clients.size,
            });
            for (const client of room.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(leaveNotice);
              }
            }
          }
        }
        return;
      }

      // ----------------------------------------------------------------------
      // B. CONNECT TO DEVICE (SPOTIFY-STYLE REMOTE CONTROL)
      // ----------------------------------------------------------------------
      if (data.type === 'REGISTER_DEVICE' || data.type === 'DEVICE_BEACON') {
        const device = data.device || data;
        if (!device || !device.deviceId) return;

        meta.deviceId = device.deviceId;
        devices.set(device.deviceId, {
          ws,
          device: {
            ...device,
            isOnline: true,
            lastSeenAt: Date.now(),
          },
          lastSeen: Date.now(),
        });

        // Broadcast new device presence to all devices on the same network/account
        broadcastDeviceList(device.subnet, device.accountId);
        return;
      }

      if (data.type === 'CONNECT_COMMAND') {
        const { targetDeviceId, command } = data;
        const target = devices.get(targetDeviceId);

        if (target && target.ws && target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(JSON.stringify({
            type: 'CONNECT_COMMAND',
            payload: command || data,
          }));
        }
        return;
      }

      if (data.type === 'SESSION_UPDATE') {
        const { session } = data;
        // Broadcast session update to all connected devices
        const updateStr = JSON.stringify({
          type: 'SESSION_UPDATE',
          payload: session || data.payload,
        });

        for (const record of devices.values()) {
          if (record.ws !== ws && record.ws.readyState === WebSocket.OPEN) {
            record.ws.send(updateStr);
          }
        }
        return;
      }

    } catch (err) {
      console.error('[WebSocket] Failed to parse frame:', err);
    }
  });

  ws.on('close', () => {
    // 1. Clean up Jam room presence
    if (meta.roomId && rooms.has(meta.roomId)) {
      const room = rooms.get(meta.roomId);
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        rooms.delete(meta.roomId);
      }
    }

    // 2. Clean up Connect device presence
    if (meta.deviceId && devices.has(meta.deviceId)) {
      const record = devices.get(meta.deviceId);
      devices.delete(meta.deviceId);
      if (record && record.device) {
        broadcastDeviceList(record.device.subnet, record.device.accountId);
      }
    }
  });
});

// ============================================================================
// 4. Render Sleep Prevention (Keeps Free Tier Alive 24/7)
// ============================================================================
const APP_URL = process.env.RENDER_EXTERNAL_URL;
if (APP_URL) {
  console.log(`[Keep-Alive] Configured for Render at: ${APP_URL}`);
  setInterval(() => {
    const pingUrl = APP_URL.startsWith('http') ? `${APP_URL}/health` : `https://${APP_URL}/health`;
    http.get(pingUrl, (res) => {
      // Consume response to free socket
      res.resume();
    }).on('error', (e) => {
      console.warn('[Keep-Alive] Ping failed:', e.message);
    });
  }, 13 * 60 * 1000); // Self-ping every 13 minutes
}

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  RaagaX Sync & Connect Coordinator Active`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Keep-Alive URL: ${APP_URL || 'Local / None'}`);
  console.log(`====================================================`);
});

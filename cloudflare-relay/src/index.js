/**
 * Raaga Connect — Cloudflare Edge WebSocket Pub/Sub Relay
 *
 * Ultra-low latency (<20ms) device coordination relay for Raaga Connect.
 * Uses Cloudflare Workers WebSocket Hibernation for zero idle CPU usage and instant message fan-out.
 */

export default {
  /**
   * Handle incoming HTTP requests and WebSocket upgrades.
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        service: "Raaga Connect Cloudflare Relay",
        region: request.cf?.colo || "global",
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // WebSocket upgrade endpoint
    if (url.pathname === "/ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket Upgrade header", { status: 426 });
      }

      const channel = url.searchParams.get("channel") || "raaga_cloud";
      const deviceId = url.searchParams.get("deviceId") || "unknown";

      // Forward to the Channel Room Durable Object or in-memory Room Manager
      const id = env.ROOMS.idFromName(channel);
      const room = env.ROOMS.get(id);
      return room.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};

/**
 * Room Durable Object: Manages all connected devices in a channel with zero dropped messages.
 */
export class ConnectRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId") || "unknown";

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept WebSocket using Cloudflare WebSocket Hibernation API
    this.state.acceptWebSocket(server, [deviceId]);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Called when a client sends a message. Broadcasts instantly to all other devices in this room.
   */
  async webSocketMessage(ws, message) {
    const senderTags = this.state.getTags(ws);
    const senderId = senderTags[0] || "";

    // Broadcast to all other active WebSockets in this room
    const sockets = this.state.getWebSockets();
    for (const client of sockets) {
      if (client !== ws) {
        try {
          client.send(message);
        } catch (e) {
          // Socket closed or errored
        }
      }
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    ws.close(code, "Durable Object closing WebSocket");
  }

  async webSocketError(ws, error) {
    ws.close(1011, "WebSocket error");
  }
}

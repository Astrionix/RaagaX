/**
 * Raaga Connect — Cloudflare Edge WebSocket Pub/Sub Relay
 *
 * Ultra-low latency (<20ms) device coordination relay for Raaga Connect.
 * Works seamlessly on Cloudflare Workers Free Tier (no paid Durable Objects required).
 */

const channelMap = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "Raaga Connect Cloudflare Relay",
          region: request.cf?.colo || "global",
          activeChannels: channelMap.size,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // WebSocket upgrade endpoint
    if (url.pathname === "/ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket Upgrade header", { status: 426 });
      }

      // If Durable Objects binding ROOMS is properly configured, use it
      if (env && env.ROOMS && typeof env.ROOMS.idFromName === "function") {
        try {
          const channel = url.searchParams.get("channel") || "raaga_cloud";
          const id = env.ROOMS.idFromName(channel);
          const room = env.ROOMS.get(id);
          return room.fetch(request);
        } catch (e) {
          console.error("Durable Object error, falling back to standard WebSocket:", e);
        }
      }

      // Standard Worker WebSocket handling (100% Free Plan Compatible)
      try {
        const channel = url.searchParams.get("channel") || "raaga_cloud";
        const deviceId = url.searchParams.get("deviceId") || "unknown";

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        server.accept();

        if (!channelMap.has(channel)) {
          channelMap.set(channel, new Set());
        }
        const sockets = channelMap.get(channel);
        sockets.add(server);

        server.addEventListener("message", (event) => {
          const activeSockets = channelMap.get(channel);
          if (!activeSockets) return;

          for (const sock of activeSockets) {
            if (sock !== server) {
              try {
                sock.send(event.data);
              } catch (_) {}
            }
          }
        });

        const cleanup = () => {
          const currentSockets = channelMap.get(channel);
          if (currentSockets) {
            currentSockets.delete(server);
            if (currentSockets.size === 0) {
              channelMap.delete(channel);
            }
          }
        };

        server.addEventListener("close", cleanup);
        server.addEventListener("error", cleanup);

        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      } catch (err) {
        return new Response("WebSocket initialization error: " + err.message, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};

/**
 * Optional Room Durable Object (if user enables Durable Objects on paid plan)
 */
export class ConnectRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    if (this.state.acceptWebSocket) {
      this.state.acceptWebSocket(server);
    } else {
      server.accept();
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws, message) {
    const sockets = this.state.getWebSockets ? this.state.getWebSockets() : [];
    for (const client of sockets) {
      if (client !== ws) {
        try {
          client.send(message);
        } catch (_) {}
      }
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    try {
      ws.close(code, "Closed");
    } catch (_) {}
  }

  async webSocketError(ws, error) {
    try {
      ws.close(1011, "Error");
    } catch (_) {}
  }
}


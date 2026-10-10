/**
 * Raaga Connect — Cloudflare Edge WebSocket Pub/Sub Relay
 *
 * Ultra-low latency (<20ms in India) multi-device synchronization relay.
 * Runs on Cloudflare Workers with Durable Objects (100% Free on Workers Free Plan).
 */

const channelMap = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      const hasDurableObjects = Boolean(env && env.ROOMS && typeof env.ROOMS.idFromName === "function");
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "Raaga Connect Cloudflare Relay",
          region: request.cf?.colo || "global",
          durableObjectsActive: hasDurableObjects,
          activeChannels: channelMap.size,
          hint: hasDurableObjects 
            ? "Durable Objects active: multi-device synchronization is enabled." 
            : "To enable multi-device sync, add Durable Object binding in Cloudflare Dashboard: Variable name 'ROOMS', Class 'ConnectRoom'.",
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

      // If Durable Objects binding ROOMS is configured, route to Durable Object room
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

      // Fallback: Standard Worker WebSocket handling (for single-isolate testing)
      try {
        const channel = url.searchParams.get("channel") || "raaga_cloud";
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
 * ConnectRoom Durable Object (Handles shared room WebSocket broadcasting)
 * Cloudflare routes all clients for the same channel to this exact instance globally.
 */
export class ConnectRoom {
  constructor(state, env) {
    this.state = state;
    this.ctx = state;
    this.env = env;
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    const ctx = this.ctx || this.state;
    if (ctx && typeof ctx.acceptWebSocket === "function") {
      ctx.acceptWebSocket(server);
    } else {
      server.accept();
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws, message) {
    const ctx = this.ctx || this.state;
    const sockets = ctx && typeof ctx.getWebSockets === "function" ? ctx.getWebSockets() : [];
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


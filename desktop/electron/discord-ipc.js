/**
 * Zero-dependency Discord Rich Presence IPC Client for Node.js / Electron.
 * Communicates directly with Discord desktop client via local IPC socket / named pipe.
 */
const net = require("net");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
};

const DEFAULT_CLIENT_ID = "1217743950187434035"; // Raaga Music Discord Application ID

class DiscordIPC {
  constructor(clientId = DEFAULT_CLIENT_ID) {
    this.clientId = clientId;
    this.socket = null;
    this.connected = false;
    this.connecting = false;
    this.queuedActivity = null;
    this.reconnectTimer = null;
  }

  getSocketPath(id = 0) {
    if (process.platform === "win32") {
      return `\\\\?\\pipe\\discord-ipc-${id}`;
    }
    const env = process.env;
    const prefix = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || "/tmp";
    return path.join(prefix, `discord-ipc-${id}`);
  }

  connect() {
    if (this.connected || this.connecting) return;
    this.connecting = true;

    const tryPath = (id = 0) => {
      if (id >= 10) {
        this.connecting = false;
        // Schedule retry
        this.scheduleReconnect(15000);
        return;
      }

      const sockPath = this.getSocketPath(id);
      const client = net.createConnection(sockPath, () => {
        this.socket = client;
        this.connected = true;
        this.connecting = false;
        this.sendHandshake();

        if (this.queuedActivity) {
          this.setActivity(this.queuedActivity);
        }
      });

      client.on("data", (data) => {
        // Can handle incoming frames if necessary
      });

      client.on("error", () => {
        client.destroy();
        tryPath(id + 1);
      });

      client.on("close", () => {
        this.connected = false;
        this.socket = null;
        this.scheduleReconnect(10000);
      });
    };

    tryPath(0);
  }

  scheduleReconnect(delayMs) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.connected) this.connect();
    }, delayMs);
  }

  send(opcode, payload) {
    if (!this.socket || !this.connected) return;

    try {
      const json = JSON.stringify(payload);
      const len = Buffer.byteLength(json);
      const packet = Buffer.alloc(8 + len);

      packet.writeInt32LE(opcode, 0);
      packet.writeInt32LE(len, 4);
      packet.write(json, 8, len, "utf8");

      this.socket.write(packet);
    } catch (err) {
      console.warn("[Discord IPC] Send error:", err.message);
    }
  }

  sendHandshake() {
    this.send(OPCODES.HANDSHAKE, {
      v: 1,
      client_id: this.clientId,
    });
  }

  setActivity(activity) {
    this.queuedActivity = activity;
    if (!this.connected) {
      this.connect();
      return;
    }

    const payload = {
      cmd: "SET_ACTIVITY",
      args: {
        pid: process.pid,
        activity: activity || null,
      },
      nonce: crypto.randomUUID(),
    };

    this.send(OPCODES.FRAME, payload);
  }

  clearActivity() {
    this.queuedActivity = null;
    if (this.connected) {
      this.setActivity(null);
    }
  }

  destroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      try {
        this.send(OPCODES.CLOSE, {});
        this.socket.destroy();
      } catch (_) {}
    }
    this.connected = false;
    this.socket = null;
  }
}

module.exports = { DiscordIPC, DEFAULT_CLIENT_ID };

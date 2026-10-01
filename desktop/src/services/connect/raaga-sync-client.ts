import { ConnectDevice, PlaybackSession, RemoteCommand } from "@/types/music";
import { generateUUID } from "@/lib/utils";

export type SyncEventHandler = (event: {
  type: string;
  payload?: any;
  devices?: ConnectDevice[];
}) => void;

class RaagaSyncClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private listeners: Set<SyncEventHandler> = new Set();
  private pingInterval: any = null;
  private reconnectTimeout: any = null;

  public deviceId: string = "";
  public deviceName: string = "Raaga Web (Browser)";
  public activeServerUrl: string =
    process.env.NEXT_PUBLIC_RAAGA_SYNC_URL ||
    "wss://raaga-sync-server-x2xy.onrender.com";

  constructor() {
    if (typeof window !== "undefined") {
      // Get or create persistent device ID
      let savedId = localStorage.getItem("raaga_device_id");
      if (!savedId) {
        savedId = "web_" + generateUUID().replace(/-/g, "").substring(0, 10);
        localStorage.setItem("raaga_device_id", savedId);
      }
      this.deviceId = savedId;

      const ua = navigator.userAgent;
      const isMac = ua.includes("Macintosh");
      const isWindows = ua.includes("Windows");
      const platform = isMac ? "macOS" : isWindows ? "Windows" : "Web";
      this.deviceName = `Raaga Web (${platform})`;
    }
  }

  public connect(accountId?: string) {
    if (typeof window === "undefined" || this.ws) return;

    try {
      this.ws = new WebSocket(this.activeServerUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log("[RaagaConnect] Connected to Sync Coordinator:", this.activeServerUrl);

        // Register this Web client
        this.send({
          type: "REGISTER_DEVICE",
          device: {
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            deviceType: "COMPUTER",
            platform: "web",
            accountId: accountId || null,
            canReceiveAudio: true,
            canControl: true,
          },
        });

        // 20-second ping heartbeat
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: "PING", payload: { timestamp: Date.now() } });
          }
        }, 20000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notify(data);
        } catch (err) {
          console.error("[RaagaConnect] Error parsing WS message:", err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.ws = null;
        clearInterval(this.pingInterval);
        // Attempt reconnect after 5s
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connect(accountId);
        }, 5000);
      };

      this.ws.onerror = (err) => {
        console.warn("[RaagaConnect] WS Error:", err);
      };
    } catch (err) {
      console.error("[RaagaConnect] Connection init failed:", err);
    }
  }

  public disconnect() {
    clearInterval(this.pingInterval);
    clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  public send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public subscribe(handler: SyncEventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private notify(event: any) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("[RaagaConnect] Listener error:", err);
      }
    });
  }

  // Remote command sender
  public sendRemoteCommand(targetDeviceId: string, command: any) {
    this.send({
      type: "CONNECT_COMMAND",
      targetDeviceId,
      command,
    });
  }

  // State broadcast for active session
  public broadcastState(payload: any, roomId?: string) {
    this.send({
      type: roomId ? "ROOM_BROADCAST" : "SESSION_UPDATE",
      roomId,
      payload,
    });
  }

  // Jam room methods
  public joinJamRoom(roomId: string, isHost: boolean = false) {
    this.send({
      type: "JOIN_ROOM",
      roomId,
      deviceId: this.deviceId,
      isHost,
    });
  }

  public leaveJamRoom(roomId: string) {
    this.send({
      type: "LEAVE_ROOM",
      roomId,
      deviceId: this.deviceId,
    });
  }
}

export const syncClient = new RaagaSyncClient();

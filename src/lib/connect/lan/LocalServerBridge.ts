'use client';

import { LANMessage } from './types';
import { RaagaXNativeConnect } from './RaagaXNativeConnect';

export type LANMessageHandler = (msg: LANMessage, remoteAddress?: string) => void;

export class LocalServerBridge {
  private static instance: LocalServerBridge;
  private listeningPort: number = 47104;
  private isRunning: boolean = false;
  private messageHandlers: Set<LANMessageHandler> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private activeClients = new Map<string, any>();

  private constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('raagax_lan_mesh');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type) {
            this.notifyHandlers(event.data, 'local_mesh');
          }
        };
      } catch (e) {
        console.warn('[LocalServerBridge] BroadcastChannel init warning:', e);
      }
    }
  }

  public static getInstance(): LocalServerBridge {
    if (!LocalServerBridge.instance) {
      LocalServerBridge.instance = new LocalServerBridge();
    }
    return LocalServerBridge.instance;
  }

  public async startServer(preferredPort: number = 47104): Promise<number> {
    if (this.isRunning) return this.listeningPort;

    this.listeningPort = preferredPort;
    this.isRunning = true;

    // 1. Android Native Check
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
    if (isAndroid) {
      try {
        const assignedPort = await RaagaXNativeConnect.startLocalServer(preferredPort);
        if (assignedPort > 0) {
          this.listeningPort = assignedPort;
          RaagaXNativeConnect.setIncomingMessageListener((msg: LANMessage) => {
            this.notifyHandlers(msg, 'native_android');
          });
        }
      } catch (err) {
        console.warn('[LocalServerBridge] Native Android server start warning:', err);
      }
    }

    console.log(`[LocalServerBridge] RaagaX Local Server running on port :${this.listeningPort}`);
    return this.listeningPort;
  }

  public stopServer() {
    this.isRunning = false;
    if (this.broadcastChannel) {
      // keep channel intact for lifecycle reuse
    }
  }

  public getPort(): number {
    return this.listeningPort;
  }

  public onMessage(handler: LANMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public broadcastToMesh(msg: LANMessage) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch (e) {
        console.warn('[LocalServerBridge] Broadcast mesh send error:', e);
      }
    }
  }

  public handleIncomingMessage(msg: LANMessage, origin: string = 'direct') {
    this.notifyHandlers(msg, origin);
  }

  private notifyHandlers(msg: LANMessage, origin: string) {
    for (const handler of this.messageHandlers) {
      try {
        handler(msg, origin);
      } catch (e) {
        console.error('[LocalServerBridge] Handler error:', e);
      }
    }
  }
}

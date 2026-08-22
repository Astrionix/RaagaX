'use client';

import { LANMessage, DiscoveredLANDevice, LANConnectionStatus } from './types';
import { LocalServerBridge } from './LocalServerBridge';

export type LANConnectionStateListener = (deviceId: string, status: LANConnectionStatus) => void;
export type LANMessageListener = (msg: LANMessage) => void;

export class DirectLANTransport {
  private static instance: DirectLANTransport;
  private connectedPeers = new Map<string, {
    socket: WebSocket | null;
    status: LANConnectionStatus;
    lastPing: number;
    lastPong: number;
    rtt: number;
  }>();

  private stateListeners = new Set<LANConnectionStateListener>();
  private messageListeners = new Set<LANMessageListener>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Listen for incoming messages from LocalServerBridge
    LocalServerBridge.getInstance().onMessage((msg: LANMessage) => {
      this.handleIncomingMessage(msg);
    });

    this.startHeartbeatMonitor();
  }

  public static getInstance(): DirectLANTransport {
    if (!DirectLANTransport.instance) {
      DirectLANTransport.instance = new DirectLANTransport();
    }
    return DirectLANTransport.instance;
  }

  public async connectToDevice(device: DiscoveredLANDevice): Promise<boolean> {
    const peerId = device.deviceId;
    this.updatePeerStatus(peerId, 'CONNECTING');

    try {
      // In same-browser mesh or localhost
      if (device.host === '127.0.0.1' || device.host === 'localhost') {
        this.connectedPeers.set(peerId, {
          socket: null,
          status: 'CONNECTED',
          lastPing: Date.now(),
          lastPong: Date.now(),
          rtt: 5,
        });
        this.updatePeerStatus(peerId, 'CONNECTED');
        return true;
      }

      // Direct WebSocket connection
      const wsUrl = `ws://${device.host}:${device.port}/raagax-connect`;
      const socket = new WebSocket(wsUrl);

      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          socket.close();
          this.updatePeerStatus(peerId, 'FAILED');
          resolve(false);
        }, 4000);

        socket.onopen = () => {
          clearTimeout(timeout);
          this.connectedPeers.set(peerId, {
            socket,
            status: 'CONNECTED',
            lastPing: Date.now(),
            lastPong: Date.now(),
            rtt: 20,
          });
          this.updatePeerStatus(peerId, 'CONNECTED');
          resolve(true);
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as LANMessage;
            this.handleIncomingMessage(msg);
          } catch (e) {
            console.warn('[DirectLANTransport] Parse error:', e);
          }
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          this.updatePeerStatus(peerId, 'FAILED');
          resolve(false);
        };

        socket.onclose = () => {
          this.updatePeerStatus(peerId, 'DISCONNECTED');
          this.connectedPeers.delete(peerId);
        };
      });
    } catch (err) {
      console.warn(`[DirectLANTransport] Connect to ${peerId} failed:`, err);
      this.updatePeerStatus(peerId, 'FAILED');
      return false;
    }
  }

  public disconnectFromDevice(deviceId: string) {
    const peer = this.connectedPeers.get(deviceId);
    if (peer?.socket) {
      try {
        peer.socket.close();
      } catch {}
    }
    this.connectedPeers.delete(deviceId);
    this.updatePeerStatus(deviceId, 'DISCONNECTED');
  }

  public sendMessage(targetDeviceId: string, msg: LANMessage): boolean {
    const peer = this.connectedPeers.get(targetDeviceId);

    // Direct socket if available
    if (peer?.socket && peer.socket.readyState === WebSocket.OPEN) {
      try {
        peer.socket.send(JSON.stringify(msg));
        return true;
      } catch (e) {
        console.warn(`[DirectLANTransport] Send failed to ${targetDeviceId}:`, e);
      }
    }

    // Direct mesh broadcast fallback
    LocalServerBridge.getInstance().broadcastToMesh(msg);
    return true;
  }

  public handleIncomingMessage(msg: LANMessage) {
    if (!msg || !msg.type) return;

    // Handle heartbeat pings immediately
    if (msg.type === 'HEARTBEAT_PING') {
      this.sendMessage(msg.sourceDeviceId, {
        id: 'pong_' + Math.random().toString(36).substring(2, 9),
        type: 'HEARTBEAT_PONG',
        sourceDeviceId: msg.targetDeviceId,
        targetDeviceId: msg.sourceDeviceId,
        timestamp: Date.now(),
      });
      return;
    }

    if (msg.type === 'HEARTBEAT_PONG') {
      const peer = this.connectedPeers.get(msg.sourceDeviceId);
      if (peer) {
        peer.lastPong = Date.now();
        peer.rtt = Math.max(1, peer.lastPong - peer.lastPing);
      }
      return;
    }

    for (const listener of this.messageListeners) {
      try {
        listener(msg);
      } catch (e) {
        console.error('[DirectLANTransport] Message listener error:', e);
      }
    }
  }

  public onMessage(listener: LANMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onConnectionState(listener: LANConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public isConnected(deviceId: string): boolean {
    return this.connectedPeers.get(deviceId)?.status === 'CONNECTED';
  }

  private updatePeerStatus(deviceId: string, status: LANConnectionStatus) {
    for (const listener of this.stateListeners) {
      try {
        listener(deviceId, status);
      } catch (e) {
        console.error('[DirectLANTransport] State listener error:', e);
      }
    }
  }

  private startHeartbeatMonitor() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [peerId, peer] of this.connectedPeers.entries()) {
        if (peer.status === 'CONNECTED') {
          // Check for dead connection (no pong for > 8s)
          if (now - peer.lastPong > 8000 && peer.lastPing - peer.lastPong > 3000) {
            console.warn(`[DirectLANTransport] Peer ${peerId} timed out on LAN`);
            this.disconnectFromDevice(peerId);
            continue;
          }

          peer.lastPing = now;
          this.sendMessage(peerId, {
            id: 'ping_' + Math.random().toString(36).substring(2, 9),
            type: 'HEARTBEAT_PING',
            sourceDeviceId: 'local',
            targetDeviceId: peerId,
            timestamp: now,
          });
        }
      }
    }, 3000);
  }
}

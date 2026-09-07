/**
 * DeviceDiscoveryEngine — Multi-Modal Spotify Connect Device Discovery
 *
 * Implements Architecture Spec §3:
 * - Multi-Modal Discovery:
 *   1. Local BroadcastChannel ('raagax_connect_bus') for instant 0ms cross-tab / local window discovery.
 *   2. Cloud Coordinator WebSocket Beacon (with automatic reconnect & keep-alive).
 *   3. LAN / mDNS support for Electron / Node nodes.
 * - Symmetrical capabilities: Every RaagaX node acts as both player and controller.
 * - Produces DiscoveredPeer objects with pubKeyFingerprint, capabilities, and transport.
 */

import { DiscoveredPeer, SignalMessage, SignalingChannel } from '../types';
import { DeviceKeyManager } from '../auth/DeviceKeyManager';
import { DeviceNameResolver } from '../auth/DeviceNameResolver';
import { getSyncWebSocketUrl } from '@/lib/config/apiConfig';
import { isAudioGloballyUnlocked } from '@/lib/playback/AudioUnlocker';

export type DiscoveryListener = (peers: DiscoveredPeer[]) => void;

export class DeviceDiscoveryEngine implements SignalingChannel {
  private static instance: DeviceDiscoveryEngine;
  private discoveredPeers = new Map<string, DiscoveredPeer>();
  private listeners = new Set<DiscoveryListener>();
  private signalListeners = new Set<(msg: SignalMessage) => void>();
  private beaconInterval?: ReturnType<typeof setInterval>;
  private cloudWs: WebSocket | null = null;
  private isScanning = false;
  private unsubNameChange?: () => void;
  private broadcastChannel: BroadcastChannel | null = null;
  private commandListeners = new Set<(cmd: any) => void>();
  private reconnectTimeout?: ReturnType<typeof setTimeout>;

  private constructor() {
    this.initBroadcastChannel();
  }

  public static getInstance(): DeviceDiscoveryEngine {
    if (typeof window !== 'undefined') {
      if (!(globalThis as any).__raaga_device_discovery__) {
        (globalThis as any).__raaga_device_discovery__ = new DeviceDiscoveryEngine();
      }
      return (globalThis as any).__raaga_device_discovery__;
    }
    if (!DeviceDiscoveryEngine.instance) {
      DeviceDiscoveryEngine.instance = new DeviceDiscoveryEngine();
    }
    return DeviceDiscoveryEngine.instance;
  }

  public onCommand(cb: (cmd: any) => void): () => void {
    this.commandListeners.add(cb);
    return () => this.commandListeners.delete(cb);
  }

  /**
   * Initializes local BroadcastChannel for 0ms cross-tab and local window discovery
   */
  private initBroadcastChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.onmessage = null;
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }

    try {
      this.broadcastChannel = new BroadcastChannel('raagax_connect_bus');
      this.broadcastChannel.onmessage = (event) => {
        try {
          const data = event.data;
          if (!data || !data.type) return;

          const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();

          if (data.type === 'CONNECT_COMMAND') {
            const cmd = data.command || data.payload;
            if (cmd) {
              if (cmd.senderDeviceId && cmd.senderDeviceId === myDeviceId) {
                return; // Suppress echo from this same device
              }
              if (data.targetDeviceId && data.targetDeviceId !== myDeviceId) {
                return; // Target is a different device
              }
              this.commandListeners.forEach(cb => {
                try { cb(cmd); } catch {}
              });
            }
            return;
          }

          if (data.type === 'SIGNAL_MESSAGE' && data.signal) {
            const sig = data.signal as SignalMessage;
            if (!sig.toDeviceId || sig.toDeviceId === myDeviceId || data.toDeviceId === myDeviceId) {
              this.signalListeners.forEach(cb => cb(sig));
            }
            return;
          }

          if (data.type === 'LAN_HANDSHAKE_REQUEST') {
            if (data.targetDeviceId === myDeviceId) {
              this.broadcastChannel?.postMessage({
                type: 'LAN_HANDSHAKE_ACK',
                targetDeviceId: data.fromDeviceId,
                fromDeviceId: myDeviceId,
              });
            }
            return;
          }

          if (data.type === 'ANNOUNCE_DEVICE' && data.peer) {
            const peer: DiscoveredPeer = data.peer;
            if (peer.deviceId === myDeviceId) return;

            this.discoveredPeers.set(peer.deviceId, {
              ...peer,
              lastSeen: Date.now(),
            });
            this.notify();

            // Reply with own presence if this was an initial announcement
            if (data.isInitial) {
              this.announceLocalPresence(false);
            }
          } else if (data.type === 'DISCOVERY_PING') {
            this.announceLocalPresence(false);
          } else if (data.type === 'PEER_LEAVE' && data.deviceId) {
            this.discoveredPeers.delete(data.deviceId);
            this.notify();
          }
        } catch (err) {
          console.warn('[DeviceDiscoveryEngine] Local bus parse error:', err);
        }
      };

      // Announce on window close / unload
      window.addEventListener('beforeunload', () => {
        try {
          const myId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
          this.broadcastChannel?.postMessage({ type: 'PEER_LEAVE', deviceId: myId });
        } catch {}
      });
    } catch (e) {
      console.warn('[DeviceDiscoveryEngine] BroadcastChannel unavailable:', e);
    }
  }

  /**
   * Immediately announces this device on the local BroadcastChannel
   */
  private async announceLocalPresence(isInitial = false) {
    if (!this.broadcastChannel) return;

    const keyManager = DeviceKeyManager.getInstance();
    const deviceId = keyManager.getOrCreateDeviceId();
    const keyPair = await keyManager.getOrCreateKeyPair();
    const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();
    const currentAccountId = typeof window !== 'undefined' ? localStorage.getItem('raagax_account_id') : null;

    const isAudioReady = typeof window !== 'undefined' ? isAudioGloballyUnlocked() : true;

    const peer: DiscoveredPeer = {
      deviceId,
      deviceName: myName,
      pubKeyFingerprint: keyPair.fingerprint,
      protoVersion: 1,
      capabilities: ['player', 'controller'],
      transport: 'mdns',
      lastSeen: Date.now(),
      accountId: currentAccountId,
      audioReady: isAudioReady,
      playerReady: true,
    };

    try {
      this.broadcastChannel.postMessage({
        type: 'ANNOUNCE_DEVICE',
        peer,
        isInitial,
      });
    } catch {}
  }

  public getDiscoveredPeers(): DiscoveredPeer[] {
    // Purge peers older than 40 seconds
    const now = Date.now();
    for (const [id, peer] of this.discoveredPeers.entries()) {
      if (now - peer.lastSeen > 40000) {
        this.discoveredPeers.delete(id);
      }
    }
    return Array.from(this.discoveredPeers.values());
  }

  public onPeersUpdated(fn: DiscoveryListener): () => void {
    this.listeners.add(fn);
    fn(this.getDiscoveredPeers());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const list = this.getDiscoveredPeers();
    this.listeners.forEach(fn => fn(list));
  }

  /**
   * Starts discovery (local bus + cloud coordinator beacon)
   */
  public async startDiscovery(role: 'player' | 'controller' = 'player', accountId?: string | null): Promise<void> {
    if (this.isScanning) {
      this.requestDiscoveryRefresh();
      return;
    }
    this.isScanning = true;

    const keyManager = DeviceKeyManager.getInstance();
    const deviceId = keyManager.getOrCreateDeviceId();
    const keyPair = await keyManager.getOrCreateKeyPair();

    // 1. Announce locally on BroadcastChannel
    this.announceLocalPresence(true);

    // Proactively initialize local Wi-Fi WebRTC P2P receiver
    if (typeof window !== 'undefined') {
      import('@/lib/connect/transport/P2PTransport').then(({ P2PTransport }) => {
        P2PTransport.initIncomingReceiver(this);
      }).catch(() => {});
    }

    // 2. Cloud Coordinator Discovery Channel
    this.connectCloudBeacon(deviceId, keyPair.fingerprint, role, accountId);

    // 3. Periodic Broadcast Beacon (every 4.5 seconds)
    if (this.beaconInterval) clearInterval(this.beaconInterval);
    this.beaconInterval = setInterval(() => {
      this.broadcastBeacon(deviceId, keyPair.fingerprint, role, accountId);
      this.announceLocalPresence(false);
    }, 4500);

    // Initial cloud broadcast
    this.broadcastBeacon(deviceId, keyPair.fingerprint, role, accountId);

    // 4. React to local device rename in real time
    if (!this.unsubNameChange) {
      this.unsubNameChange = DeviceNameResolver.getInstance().onNameChanged((newName) => {
        this.announceLocalPresence(false);
        if (this.cloudWs && this.cloudWs.readyState === WebSocket.OPEN) {
          this.cloudWs.send(JSON.stringify({
            type: 'REGISTER_DEVICE',
            device: {
              deviceId,
              deviceName: newName,
              pubKeyFingerprint: keyPair.fingerprint,
              capabilities: ['player', 'controller'],
              transport: 'cloud_presence',
              protoVersion: 1,
              accountId: accountId || null,
              audioReady: isAudioGloballyUnlocked(),
              playerReady: true,
            }
          }));
        }
      });
    }
  }

  /**
   * Triggers an immediate presence refresh across local bus and cloud
   */
  public requestDiscoveryRefresh(): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'DISCOVERY_PING' });
        this.announceLocalPresence(false);
      } catch {}
    }

    const keyManager = DeviceKeyManager.getInstance();
    const deviceId = keyManager.getOrCreateDeviceId();
    const currentAccountId = typeof window !== 'undefined' ? localStorage.getItem('raagax_account_id') : null;

    if (this.cloudWs && this.cloudWs.readyState === WebSocket.OPEN) {
      this.cloudWs.send(JSON.stringify({
        type: 'DEVICE_BEACON',
        deviceId,
        deviceName: DeviceNameResolver.getInstance().getLocalDeviceDisplayName(),
        capabilities: ['player', 'controller'],
        accountId: currentAccountId || null,
        audioReady: isAudioGloballyUnlocked(),
        playerReady: true,
        timestamp: Date.now(),
      }));
    }
  }

  private connectCloudBeacon(
    deviceId: string,
    fingerprint: string,
    role: 'player' | 'controller',
    accountId?: string | null
  ) {
    if (typeof window === 'undefined') return;

    if (this.cloudWs) {
      try {
        this.cloudWs.onclose = null;
        this.cloudWs.onerror = null;
        this.cloudWs.onmessage = null;
        this.cloudWs.close();
      } catch {}
      this.cloudWs = null;
    }

    try {
      const url = getSyncWebSocketUrl();
      const ws = new WebSocket(url);
      this.cloudWs = ws;

      ws.onopen = () => {
        const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();

        ws.send(JSON.stringify({
          type: 'REGISTER_DEVICE',
          device: {
            deviceId,
            deviceName: myName,
            pubKeyFingerprint: fingerprint,
            capabilities: ['player', 'controller'],
            transport: 'cloud_presence',
            protoVersion: 1,
            accountId: accountId || null,
            audioReady: isAudioGloballyUnlocked(),
            playerReady: true,
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'CONNECT_COMMAND') {
            const cmd = data.payload || data.command;
            if (cmd) {
              if (cmd.senderDeviceId && cmd.senderDeviceId === deviceId) {
                return; // Suppress echo from this same device
              }
              this.commandListeners.forEach(cb => {
                try { cb(cmd); } catch {}
              });
            }
            return;
          }

          if (data.type === 'SIGNAL_MESSAGE' || data.type === 'SIGNAL') {
            const sig = (data.payload || data.signal || data) as SignalMessage;
            if (sig && (!sig.toDeviceId || sig.toDeviceId === deviceId)) {
              this.signalListeners.forEach(cb => cb(sig));
            }
            return;
          }

          if (data.type === 'DEVICE_LIST_UPDATED' && Array.isArray(data.devices)) {
            const myAccountId = typeof window !== 'undefined' ? localStorage.getItem('raagax_account_id') : null;
            for (const dev of data.devices) {
              if (dev.deviceId === deviceId) continue;

              // Security & Privacy Protection: Remote cloud devices must match current account ID
              if (dev.transport === 'cloud_presence') {
                if (!myAccountId || !dev.accountId || dev.accountId !== myAccountId) {
                  continue;
                }
              }

              const peer: DiscoveredPeer = {
                deviceId: dev.deviceId,
                deviceName: dev.deviceName || 'Remote RaagaX Device',
                pubKeyFingerprint: dev.pubKeyFingerprint || 'unknown_key',
                protoVersion: dev.protoVersion || 1,
                capabilities: dev.capabilities || ['player', 'controller'],
                transport: dev.transport || 'cloud_presence',
                lastSeen: Date.now(),
                subnet: dev.subnet,
                accountId: dev.accountId,
                audioReady: Boolean(dev.audioReady),
                playerReady: Boolean(dev.playerReady ?? true),
              };

              this.discoveredPeers.set(peer.deviceId, peer);
            }
            this.notify();
          }
        } catch (err) {
          console.warn('[DeviceDiscoveryEngine] Error parsing cloud discovery message:', err);
        }
      };

      ws.onclose = () => {
        this.cloudWs = null;
        // Automatic exponential reconnect if scanning is active
        if (this.isScanning && !this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = undefined;
            if (this.isScanning) {
              this.connectCloudBeacon(deviceId, fingerprint, role, accountId);
            }
          }, 2500);
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    } catch (e) {
      console.warn('[DeviceDiscoveryEngine] Could not establish cloud beacon socket:', e);
    }
  }

  private broadcastBeacon(
    deviceId: string,
    fingerprint: string,
    role: 'player' | 'controller',
    accountId?: string | null
  ) {
    if (this.cloudWs && this.cloudWs.readyState === WebSocket.OPEN) {
      this.cloudWs.send(JSON.stringify({
        type: 'DEVICE_BEACON',
        deviceId,
        deviceName: DeviceNameResolver.getInstance().getLocalDeviceDisplayName(),
        pubKeyFingerprint: fingerprint,
        capabilities: ['player', 'controller'],
        accountId: accountId || null,
        audioReady: isAudioGloballyUnlocked(),
        playerReady: true,
        timestamp: Date.now(),
      }));
    }
  }

  public registerDiscoveredPeer(peer: DiscoveredPeer): void {
    this.discoveredPeers.set(peer.deviceId, {
      ...peer,
      lastSeen: Date.now(),
    });
    this.notify();
  }

  public stopDiscovery(): void {
    this.isScanning = false;
    if (this.beaconInterval) {
      clearInterval(this.beaconInterval);
      this.beaconInterval = undefined;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    if (this.unsubNameChange) {
      this.unsubNameChange();
      this.unsubNameChange = undefined;
    }
    if (this.cloudWs) {
      try { this.cloudWs.close(); } catch {}
      this.cloudWs = null;
    }
  }

  /**
   * Dispatches WebRTC Signaling frames across local BroadcastChannel and Cloud Coordinator
   */
  public async sendSignal(msg: SignalMessage): Promise<void> {
    // 1. Send via local BroadcastChannel (for 0ms same-machine P2P)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'SIGNAL_MESSAGE',
          signal: msg,
          toDeviceId: msg.toDeviceId,
        });
      } catch {}
    }

    // 2. Send via Cloud Coordinator (for cross-device local Wi-Fi ICE & SDP exchange)
    if (this.cloudWs && this.cloudWs.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'SIGNAL_MESSAGE',
          toDeviceId: msg.toDeviceId,
          targetDeviceId: msg.toDeviceId,
          payload: msg,
        }));
      } catch {}
    }
  }

  public onSignal(cb: (msg: SignalMessage) => void): () => void {
    this.signalListeners.add(cb);
    return () => this.signalListeners.delete(cb);
  }

  /**
   * Direct Cloud Command Dispatcher (high reliability backup for control commands)
   */
  public sendCloudCommand(targetDeviceId: string, cmd: any): boolean {
    if (this.cloudWs && this.cloudWs.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'CONNECT_COMMAND',
          targetDeviceId,
          command: cmd,
        }));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

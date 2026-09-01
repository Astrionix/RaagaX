/**
 * RaagaX Connect — Server Device Registry & Real-Time Push Broker
 *
 * In-memory global registry keeping track of active online devices,
 * authoritative sessions, and persistent Server-Sent Events (SSE) push streams.
 */

import { ConnectDevice, ConnectCommand, ConnectPlaybackSession } from '@/types/connect';

const DEVICE_TTL_MS = 15000; // 15 seconds expiration

type StreamPushCallback = (data: { type: string; payload: any }) => void;

interface DeviceRegistryStore {
  devices: Map<string, ConnectDevice & { subnet?: string; email?: string }>;
  sessions: Map<string, ConnectPlaybackSession>;
  pendingCommands: Map<string, ConnectCommand[]>;
  streamClients: Map<string, Set<StreamPushCallback>>;
}

// Persist in globalThis to survive Next.js dev server hot reloading
const globalRegistry = globalThis as unknown as {
  __raaga_connect_registry?: DeviceRegistryStore;
};

if (!globalRegistry.__raaga_connect_registry) {
  globalRegistry.__raaga_connect_registry = {
    devices: new Map(),
    sessions: new Map(),
    pendingCommands: new Map(),
    streamClients: new Map(),
  };
}

const store = globalRegistry.__raaga_connect_registry;
if (!store.devices) store.devices = new Map();
if (!store.sessions) store.sessions = new Map();
if (!store.pendingCommands) store.pendingCommands = new Map();
if (!store.streamClients) store.streamClients = new Map();

export class ConnectDeviceRegistry {
  public static registerBeacon(device: ConnectDevice, subnet?: string, email?: string): void {
    const now = Date.now();
    const isNew = !store.devices.has(device.deviceId);
    store.devices.set(device.deviceId, {
      ...device,
      subnet: subnet || '127.0.0',
      email: email || '',
      lastSeenAt: now,
      isOnline: true,
    });

    if (isNew) {
      ConnectDeviceRegistry.broadcastDeviceList();
    }
  }

  public static unregisterDevice(deviceId: string): void {
    store.devices.delete(deviceId);
    store.pendingCommands.delete(deviceId);
    store.streamClients.delete(deviceId);
    ConnectDeviceRegistry.broadcastDeviceList();
  }

  public static broadcastDeviceList(): void {
    const clients = store.streamClients || (store.streamClients = new Map());
    for (const [targetId, callbacks] of clients.entries()) {
      const devices = ConnectDeviceRegistry.getActiveDevices(targetId);
      callbacks.forEach((cb) => {
        try {
          cb({ type: 'DEVICE_LIST_UPDATED', payload: devices });
        } catch {}
      });
    }
  }

  public static getActiveDevices(excludeDeviceId?: string, subnet?: string, accountId?: string): ConnectDevice[] {
    const now = Date.now();
    const result: ConnectDevice[] = [];

    for (const [id, dev] of store.devices.entries()) {
      if (now - dev.lastSeenAt > DEVICE_TTL_MS) {
        store.devices.delete(id);
        // Dead-Sink Failover: If the active speaker tab/device dropped, pause session and notify controllers
        for (const [sessId, session] of store.sessions.entries()) {
          if (session.playbackDeviceId === id) {
            session.isPlaying = false;
            session.playbackState = 'PAUSED';
            session.updatedAt = now;
            session.revision = (session.revision || 0) + 1;
            ConnectDeviceRegistry.publishSession(session);
          }
        }
        continue;
      }

      if (excludeDeviceId && id === excludeDeviceId) {
        continue;
      }

      // Check Account Match & Subnet Match
      const isSameAccount = Boolean(accountId && dev.accountId && accountId === dev.accountId);
      const isSameSubnet = Boolean(
        !subnet || !dev.subnet ||
        subnet === dev.subnet ||
        subnet.includes('127.0.0') ||
        dev.subnet.includes('127.0.0') ||
        subnet === '::1' ||
        dev.subnet === '::1' ||
        dev.ip === '127.0.0.1' ||
        dev.ip === 'localhost'
      );

      // Rule: Only omit if explicitly belonging to a DIFFERENT distinct account on a DIFFERENT network
      if (accountId && dev.accountId && accountId !== dev.accountId && !isSameSubnet) {
        continue;
      }

      // Resolve Transport & Auth Status
      let transport: 'LOCAL_LAN' | 'CLOUD_RELAY' = 'LOCAL_LAN';
      let authStatus: any = 'AUTO_AUTHORIZED';

      if (isSameAccount) {
        // Same account: Auto-authorized
        // If on same Wi-Fi -> LOCAL_LAN; else -> CLOUD_RELAY
        transport = isSameSubnet ? 'LOCAL_LAN' : 'CLOUD_RELAY';
        authStatus = 'AUTO_AUTHORIZED';
      } else if (isSameSubnet) {
        // Different account on same Wi-Fi -> LOCAL_LAN with Pairing
        transport = 'LOCAL_LAN';
        try {
          const { PairingManager } = require('./authorization/PairingManager');
          const paired = excludeDeviceId ? PairingManager.getInstance().isPaired(excludeDeviceId, dev.deviceId) : false;
          authStatus = paired ? 'PAIRED' : (dev.accountId ? 'REQUIRES_PAIRING' : 'AUTO_AUTHORIZED');
        } catch {
          authStatus = dev.accountId ? 'REQUIRES_PAIRING' : 'AUTO_AUTHORIZED';
        }
      } else {
        transport = 'CLOUD_RELAY';
        authStatus = 'DENIED';
      }

      result.push({
        deviceId: dev.deviceId,
        deviceName: dev.deviceName,
        deviceType: dev.deviceType,
        platform: dev.platform,
        ip: dev.ip,
        port: dev.port,
        isCurrentDevice: false,
        isOnline: true,
        state: dev.state,
        currentSong: dev.currentSong,
        positionMs: dev.positionMs,
        durationMs: dev.durationMs,
        volume: dev.volume,
        lastSeenAt: dev.lastSeenAt,
        transport,
        accountId: dev.accountId,
        authStatus,
        subnet: dev.subnet,
        isSameAccount,
        isSameSubnet,
        capabilities: dev.capabilities,
      });
    }

    return result;
  }

  public static publishSession(session: ConnectPlaybackSession): void {
    store.sessions.set(session.playbackDeviceId, {
      ...session,
      updatedAt: Date.now(),
    });

    // Push session update instantly to ALL connected clients (Inclusive Room-Wide Broadcast)
    const clients = store.streamClients || (store.streamClients = new Map());
    for (const callbacks of clients.values()) {
      callbacks.forEach((cb) => {
        try {
          cb({ type: 'SESSION_UPDATE', payload: session });
        } catch {}
      });
    }
  }

  public static getSession(playbackDeviceId: string): ConnectPlaybackSession | null {
    return (store.sessions || (store.sessions = new Map())).get(playbackDeviceId) || null;
  }

  public static queueCommand(command: ConnectCommand): void {
    // 1. Central Session Link Persistence (Single Source of Truth)
    if (command.action === 'TRANSFER_PLAYBACK' || command.action === 'PLAY_SONG') {
      const now = Date.now();
      const existing = store.sessions.get(command.targetDeviceId);
      const updatedSession: ConnectPlaybackSession = {
        sessionId: existing?.sessionId || `sess_${now.toString(36)}`,
        playbackDeviceId: command.targetDeviceId,
        playbackDeviceName: store.devices.get(command.targetDeviceId)?.deviceName || 'Remote Speaker',
        controllerDeviceId: command.senderDeviceId,
        controllerDeviceName: command.senderName || 'Remote Controller',
        controllerIds: [command.senderDeviceId],
        currentTrackId: command.payload?.song?.id || existing?.currentTrackId || '',
        currentQueueItemId: `qitem_${command.payload?.song?.id || 'track'}_${now}`,
        currentSong: command.payload?.song || existing?.currentSong || null,
        metadata: {
          trackId: command.payload?.song?.id || '',
          title: command.payload?.song?.title || 'Unknown Title',
          artist: command.payload?.song?.artist || 'Unknown Artist',
          album: command.payload?.song?.album || '',
          artworkUrl: command.payload?.song?.coverUrl || '',
          durationMs: Math.round((command.payload?.song?.duration || 0) * 1000),
          audioUrl: command.payload?.song?.audioUrl || '',
        },
        queue: command.payload?.queue || existing?.queue || [],
        queueIndex: command.payload?.queueIndex ?? existing?.queueIndex ?? 0,
        history: existing?.history || [],
        positionMs: command.payload?.positionMs ?? existing?.positionMs ?? 0,
        anchorPositionMs: command.payload?.positionMs ?? existing?.anchorPositionMs ?? 0,
        anchorTimeMs: now,
        durationMs: Math.round((command.payload?.song?.duration || 0) * 1000),
        isPlaying: command.payload?.isPlaying ?? true,
        playbackState: 'BUFFERING',
        volume: command.payload?.volume ?? existing?.volume ?? 0.8,
        shuffle: existing?.shuffle ?? false,
        repeat: existing?.repeat ?? 'OFF',
        timelineId: command.payload?.timelineId || `TL_${now.toString(36)}`,
        generation: (existing?.generation || 0) + 1,
        revision: (existing?.revision || 0) + 1,
        updatedAt: now,
      };

      ConnectDeviceRegistry.publishSession(updatedSession);
    } else if (command.action === 'PAUSE') {
      const existing = store.sessions.get(command.targetDeviceId);
      if (existing) {
        const now = Date.now();
        const updatedSession: ConnectPlaybackSession = {
          ...existing,
          isPlaying: false,
          playbackState: 'PAUSED',
          revision: existing.revision + 1,
          updatedAt: now,
        };
        ConnectDeviceRegistry.publishSession(updatedSession);
      }
    } else if (command.action === 'RESUME' || command.action === 'PLAY') {
      const existing = store.sessions.get(command.targetDeviceId);
      if (existing) {
        const now = Date.now();
        const updatedSession: ConnectPlaybackSession = {
          ...existing,
          isPlaying: true,
          playbackState: 'PLAYING',
          revision: existing.revision + 1,
          updatedAt: now,
        };
        ConnectDeviceRegistry.publishSession(updatedSession);
      }
    } else if (command.action === 'SEEK') {
      const existing = store.sessions.get(command.targetDeviceId);
      if (existing && typeof command.payload?.positionMs === 'number') {
        const now = Date.now();
        const updatedSession: ConnectPlaybackSession = {
          ...existing,
          positionMs: command.payload.positionMs,
          anchorPositionMs: command.payload.positionMs,
          anchorTimeMs: now,
          revision: existing.revision + 1,
          updatedAt: now,
        };
        ConnectDeviceRegistry.publishSession(updatedSession);
      }
    } else if (command.action === 'SET_VOLUME') {
      const existing = store.sessions.get(command.targetDeviceId);
      if (existing && typeof command.payload?.volume === 'number') {
        const now = Date.now();
        const updatedSession: ConnectPlaybackSession = {
          ...existing,
          volume: command.payload.volume,
          revision: existing.revision + 1,
          updatedAt: now,
        };
        ConnectDeviceRegistry.publishSession(updatedSession);
      }
    }

    const pCommands = store.pendingCommands || (store.pendingCommands = new Map());
    const list = pCommands.get(command.targetDeviceId) || [];
    list.push(command);
    pCommands.set(command.targetDeviceId, list);

    // Instant SSE push to target device if connected
    const clients = store.streamClients || (store.streamClients = new Map());
    const callbacks = clients.get(command.targetDeviceId);
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach((cb) => cb({ type: 'COMMAND', payload: command }));
      // Drain immediately once pushed
      this.fetchAndDrainCommands(command.targetDeviceId);
    }
  }

  public static fetchAndDrainCommands(targetDeviceId: string): ConnectCommand[] {
    const pCommands = store.pendingCommands || (store.pendingCommands = new Map());
    const commands = pCommands.get(targetDeviceId) || [];
    pCommands.set(targetDeviceId, []);
    return commands;
  }

  public static subscribeStream(deviceId: string, callback: StreamPushCallback): () => void {
    const clients = store.streamClients || (store.streamClients = new Map());
    const set = clients.get(deviceId) || new Set();
    set.add(callback);
    clients.set(deviceId, set);

    return () => {
      const current = clients.get(deviceId);
      if (current) {
        current.delete(callback);
        if (current.size === 0) {
          clients.delete(deviceId);
        }
      }
    };
  }
}

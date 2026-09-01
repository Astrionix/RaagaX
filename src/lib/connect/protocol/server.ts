/**
 * RaagaX Connect — Backend Session Coordinator
 * Production-ready WebSocket coordinator managing account presence,
 * monotonic state versioning, atomic handoffs, and out-of-order packet drops.
 */

import {
  ConnectedDevice,
  PlaybackSessionState,
  ServerMessage,
  ClientCommand,
  RegisterDevicePayload,
  TransferPlaybackPayload,
  SeekPayload,
  VolumePayload,
  ShufflePayload,
  RepeatPayload,
  QueueMutatePayload,
} from './types';

export interface WebSocketConnectionLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface RedisPubSubAdapter {
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, callback: (message: string) => void): Promise<void>;
  setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

export class InMemoryRedisAdapter implements RedisPubSubAdapter {
  private store: Map<string, { value: string; expiryMs: number }> = new Map();
  private channels: Map<string, Set<(message: string) => void>> = new Map();

  public async publish(channel: string, message: string): Promise<void> {
    const subscribers = this.channels.get(channel);
    if (subscribers) {
      subscribers.forEach((cb) => cb(message));
    }
  }

  public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    let set = this.channels.get(channel);
    if (!set) {
      set = new Set();
      this.channels.set(channel, set);
    }
    set.add(callback);
  }

  public async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiryMs: Date.now() + ttlSeconds * 1000 });
  }

  public async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiryMs) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  public async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

interface ClientContext {
  readonly userId: string;
  readonly deviceId: string;
  readonly socket: WebSocketConnectionLike;
}

export class ConnectCoordinatorServer {
  private readonly redis: RedisPubSubAdapter;
  private readonly clientsByUserId: Map<string, Map<string, ClientContext>> = new Map();
  private readonly sessionsByUserId: Map<string, PlaybackSessionState> = new Map();
  private readonly processedCommandIds: Set<string> = new Set();

  public constructor(redisAdapter?: RedisPubSubAdapter) {
    this.redis = redisAdapter ?? new InMemoryRedisAdapter();
  }

  /**
   * Handle incoming client WebSocket connection
   */
  public handleConnection(socket: WebSocketConnectionLike, userId: string, deviceId: string): void {
    let userClients = this.clientsByUserId.get(userId);
    if (!userClients) {
      userClients = new Map();
      this.clientsByUserId.set(userId, userClients);
    }

    const context: ClientContext = { userId, deviceId, socket };
    userClients.set(deviceId, context);

    // Provide initial state hydration on connection
    const currentSession = this.getOrCreateSession(userId);
    this.sendToSocket(socket, {
      type: 'FULL_HYDRATE',
      state: currentSession,
      serverTimestampMs: Date.now(),
    });

    this.broadcastDeviceList(userId);
  }

  /**
   * Handle client disconnect
   */
  public handleDisconnect(userId: string, deviceId: string): void {
    const userClients = this.clientsByUserId.get(userId);
    if (userClients) {
      userClients.delete(deviceId);
      if (userClients.size === 0) {
        this.clientsByUserId.delete(userId);
      }
    }

    // If disconnected device was active sink, pause playback
    const session = this.sessionsByUserId.get(userId);
    if (session && session.activeSinkDeviceId === deviceId) {
      const now = Date.now();
      const updated: PlaybackSessionState = {
        ...session,
        playbackState: 'PAUSED',
        serverTimestampMs: now,
        stateVersion: session.stateVersion + 1,
      };
      this.sessionsByUserId.set(userId, updated);
      this.broadcastToUser(userId, {
        type: 'STATE_MUTATION',
        delta: {
          stateVersion: updated.stateVersion,
          serverTimestampMs: now,
          playbackState: 'PAUSED',
        },
        serverTimestampMs: now,
      });
    }

    this.broadcastDeviceList(userId);
  }

  /**
   * Dispatch typed client command
   */
  public async handleCommand(userId: string, rawMessage: string): Promise<void> {
    let command: ClientCommand;
    try {
      command = JSON.parse(rawMessage) as ClientCommand;
    } catch {
      return;
    }

    if (!command || command.type !== 'COMMAND') return;

    // 1. Deduplication guard
    if (this.processedCommandIds.has(command.commandId)) {
      return;
    }
    this.processedCommandIds.add(command.commandId);

    const session = this.getOrCreateSession(userId);

    // 2. Monotonic out-of-order drop guard (Skip for atomic handoff / song selection)
    if (
      command.action !== 'TRANSFER_PLAYBACK' &&
      command.action !== 'PLAY_SONG' &&
      typeof command.expectedVersion === 'number' &&
      command.expectedVersion < session.stateVersion
    ) {
      const userClients = this.clientsByUserId.get(userId);
      const sender = userClients?.get(command.originDeviceId);
      if (sender) {
        this.sendToSocket(sender.socket, {
          type: 'ERROR',
          code: 'STALE_VERSION',
          message: `Rejected out-of-order command. Expected version ${command.expectedVersion} < ${session.stateVersion}`,
          commandId: command.commandId,
          serverTimestampMs: Date.now(),
        });
      }
      return;
    }

    // 3. Execute action
    await this.routeAction(userId, command, session);
  }

  private async routeAction(
    userId: string,
    command: ClientCommand,
    session: PlaybackSessionState
  ): Promise<void> {
    const now = Date.now();

    switch (command.action) {
      case 'REGISTER_DEVICE': {
        const payload = command.payload as RegisterDevicePayload;
        const deviceRecord: ConnectedDevice = {
          deviceId: payload.deviceId,
          userId,
          name: payload.name,
          deviceType: payload.deviceType,
          capabilities: payload.capabilities,
          lastSeenMs: now,
          isOnline: true,
        };
        await this.redis.setWithTtl(
          `connect:dev:${userId}:${payload.deviceId}`,
          JSON.stringify(deviceRecord),
          30
        );
        this.broadcastDeviceList(userId);
        break;
      }

      case 'TRANSFER_PLAYBACK': {
        const payload = command.payload as TransferPlaybackPayload;
        const targetDeviceId = payload.targetDeviceId;
        const oldSinkId = session.activeSinkDeviceId;

        const currentElapsedMs =
          session.playbackState === 'PLAYING'
            ? Math.max(0, now - session.serverTimestampMs)
            : 0;
        const finalExitPosMs = payload.seekPositionMs ?? (session.positionMs + currentElapsedMs);

        // Step 1: Tell previous sink to stop immediately
        if (oldSinkId && oldSinkId !== targetDeviceId) {
          const oldClient = this.clientsByUserId.get(userId)?.get(oldSinkId);
          if (oldClient) {
            this.sendToSocket(oldClient.socket, {
              type: 'PAUSE_AND_FLUSH',
              commandId: command.commandId,
              targetDeviceId: oldSinkId,
              serverTimestampMs: now,
            });
          }
        }

        // Step 2: Atomic state elevation with monotonic version increment
        const nextVersion = session.stateVersion + 1;
        const nextTrack = payload.track !== undefined ? payload.track : session.currentTrack;
        const nextQueue = payload.queue !== undefined ? payload.queue : session.queue;

        const newSession: PlaybackSessionState = {
          ...session,
          activeSinkDeviceId: targetDeviceId,
          currentTrack: nextTrack,
          queue: nextQueue,
          playbackState: payload.autoPlay ? 'PLAYING' : 'PAUSED',
          positionMs: finalExitPosMs,
          serverTimestampMs: now,
          stateVersion: nextVersion,
        };
        this.sessionsByUserId.set(userId, newSession);

        // Step 3: Command target sink to load and play at exact offset
        if (nextTrack) {
          const targetClient = this.clientsByUserId.get(userId)?.get(targetDeviceId);
          if (targetClient) {
            this.sendToSocket(targetClient.socket, {
              type: 'LOAD_AND_PLAY',
              commandId: command.commandId,
              track: nextTrack,
              offsetMs: finalExitPosMs,
              autoPlay: payload.autoPlay,
              serverTimestampMs: now,
            });
          }
        }

        // Step 4: Broadcast full hydrate to all controller nodes
        this.broadcastToUser(userId, {
          type: 'FULL_HYDRATE',
          state: newSession,
          serverTimestampMs: now,
        });
        break;
      }

      case 'PLAY': {
        const nextVersion = session.stateVersion + 1;
        const updated: PlaybackSessionState = {
          ...session,
          playbackState: 'PLAYING',
          serverTimestampMs: now,
          stateVersion: nextVersion,
        };
        this.sessionsByUserId.set(userId, updated);
        this.broadcastToUser(userId, {
          type: 'STATE_MUTATION',
          delta: {
            stateVersion: nextVersion,
            serverTimestampMs: now,
            playbackState: 'PLAYING',
          },
          serverTimestampMs: now,
        });
        break;
      }

      case 'PAUSE': {
        const currentElapsed =
          session.playbackState === 'PLAYING'
            ? Math.max(0, now - session.serverTimestampMs)
            : 0;
        const exactPos = session.positionMs + currentElapsed;
        const nextVersion = session.stateVersion + 1;

        const updated: PlaybackSessionState = {
          ...session,
          playbackState: 'PAUSED',
          positionMs: exactPos,
          serverTimestampMs: now,
          stateVersion: nextVersion,
        };
        this.sessionsByUserId.set(userId, updated);
        this.broadcastToUser(userId, {
          type: 'STATE_MUTATION',
          delta: {
            stateVersion: nextVersion,
            serverTimestampMs: now,
            playbackState: 'PAUSED',
            positionMs: exactPos,
          },
          serverTimestampMs: now,
        });
        break;
      }

      case 'SEEK': {
        const payload = command.payload as SeekPayload;
        const targetPos = Math.max(0, payload.positionMs);
        const nextVersion = session.stateVersion + 1;

        const updated: PlaybackSessionState = {
          ...session,
          positionMs: targetPos,
          serverTimestampMs: now,
          stateVersion: nextVersion,
        };
        this.sessionsByUserId.set(userId, updated);
        this.broadcastToUser(userId, {
          type: 'STATE_MUTATION',
          delta: {
            stateVersion: nextVersion,
            serverTimestampMs: now,
            positionMs: targetPos,
          },
          serverTimestampMs: now,
        });
        break;
      }

      case 'SET_VOLUME': {
        const payload = command.payload as VolumePayload;
        const clampedVol = Math.max(0, Math.min(1, payload.volume));
        const nextVersion = session.stateVersion + 1;

        const updated: PlaybackSessionState = {
          ...session,
          volume: clampedVol,
          serverTimestampMs: now,
          stateVersion: nextVersion,
        };
        this.sessionsByUserId.set(userId, updated);
        this.broadcastToUser(userId, {
          type: 'STATE_MUTATION',
          delta: {
            stateVersion: nextVersion,
            serverTimestampMs: now,
            volume: clampedVol,
          },
          serverTimestampMs: now,
        });
        break;
      }

      case 'SKIP_NEXT': {
        if (session.queue.length === 0) return;
        const currentIdx = session.queueIndex;
        const repeat = session.repeat || 'OFF';

        let nextIdx = -1;
        if (repeat === 'ONE') {
          nextIdx = currentIdx;
        } else if (currentIdx + 1 < session.queue.length) {
          nextIdx = currentIdx + 1;
        } else if (repeat === 'ALL') {
          nextIdx = 0;
        } else {
          // Repeat OFF: Queue Exhausted!
          nextIdx = -1;
        }

        const nextVersion = session.stateVersion + 1;

        if (nextIdx === -1) {
          // Strict Queue Exhaustion: pause playback, do NOT loop to 0
          const updated: PlaybackSessionState = {
            ...session,
            playbackState: 'PAUSED',
            positionMs: 0,
            serverTimestampMs: now,
            stateVersion: nextVersion,
          };
          this.sessionsByUserId.set(userId, updated);

          if (session.activeSinkDeviceId) {
            const sinkClient = this.clientsByUserId.get(userId)?.get(session.activeSinkDeviceId);
            if (sinkClient) {
              this.sendToSocket(sinkClient.socket, {
                type: 'PAUSE_AND_FLUSH',
                commandId: command.commandId,
                targetDeviceId: session.activeSinkDeviceId,
                serverTimestampMs: now,
              });
            }
          }

          this.broadcastToUser(userId, {
            type: 'FULL_HYDRATE',
            state: updated,
            serverTimestampMs: now,
          });
          break;
        }

        const nextTrack = session.queue[nextIdx] ?? null;

        const updated: PlaybackSessionState = {
          ...session,
          queueIndex: nextIdx,
          currentTrack: nextTrack,
          positionMs: 0,
          playbackState: 'PLAYING',
          serverTimestampMs: now,
          stateVersion: nextVersion,
        };
        this.sessionsByUserId.set(userId, updated);

        if (session.activeSinkDeviceId && nextTrack) {
          const sinkClient = this.clientsByUserId.get(userId)?.get(session.activeSinkDeviceId);
          if (sinkClient) {
            this.sendToSocket(sinkClient.socket, {
              type: 'LOAD_AND_PLAY',
              commandId: command.commandId,
              track: nextTrack,
              offsetMs: 0,
              autoPlay: true,
              serverTimestampMs: now,
            });
          }
        }

        this.broadcastToUser(userId, {
          type: 'FULL_HYDRATE',
          state: updated,
          serverTimestampMs: now,
        });
        break;
      }

      case 'SKIP_PREV': {
        if (session.queue.length === 0) return;
        const currentIdx = session.queueIndex;
        const repeat = session.repeat || 'OFF';

        let prevIdx = 0;
        if (repeat === 'ONE') {
          prevIdx = currentIdx;
        } else if (currentIdx > 0) {
          prevIdx = currentIdx - 1;
        } else if (repeat === 'ALL') {
          prevIdx = session.queue.length - 1;
        } else {
          prevIdx = 0;
        }

        const prevTrack = session.queue[prevIdx] ?? null;
        const nextVersion = session.stateVersion + 1;

        const updated: PlaybackSessionState = {
          ...session,
          queueIndex: prevIdx,
          currentTrack: prevTrack,
          positionMs: 0,
          playbackState: 'PLAYING',
          serverTimestampMs: now,
          stateVersion: nextVersion,
        };
        this.sessionsByUserId.set(userId, updated);

        if (session.activeSinkDeviceId && prevTrack) {
          const sinkClient = this.clientsByUserId.get(userId)?.get(session.activeSinkDeviceId);
          if (sinkClient) {
            this.sendToSocket(sinkClient.socket, {
              type: 'LOAD_AND_PLAY',
              commandId: command.commandId,
              track: prevTrack,
              offsetMs: 0,
              autoPlay: true,
              serverTimestampMs: now,
            });
          }
        }

        this.broadcastToUser(userId, {
          type: 'FULL_HYDRATE',
          state: updated,
          serverTimestampMs: now,
        });
        break;
      }

      case 'HEARTBEAT': {
        const client = this.clientsByUserId.get(userId)?.get(command.originDeviceId);
        if (client) {
          this.sendToSocket(client.socket, {
            type: 'HEARTBEAT_ACK',
            clientTimestampMs: command.clientTimestampMs,
            serverTimestampMs: now,
          });
        }
        break;
      }
    }
  }

  public getSession(userId: string): PlaybackSessionState | null {
    return this.sessionsByUserId.get(userId) ?? null;
  }

  private getOrCreateSession(userId: string): PlaybackSessionState {
    let session = this.sessionsByUserId.get(userId);
    if (!session) {
      const now = Date.now();
      session = {
        sessionId: `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        activeSinkDeviceId: null,
        stateVersion: 1,
        serverTimestampMs: now,
        playbackState: 'IDLE',
        currentTrack: null,
        positionMs: 0,
        volume: 0.8,
        shuffle: false,
        repeat: 'OFF',
        queue: [],
        queueIndex: 0,
      };
      this.sessionsByUserId.set(userId, session);
    }
    return session;
  }

  private broadcastToUser(userId: string, message: ServerMessage): void {
    const clients = this.clientsByUserId.get(userId);
    if (!clients) return;
    clients.forEach((ctx) => {
      this.sendToSocket(ctx.socket, message);
    });
  }

  private broadcastDeviceList(userId: string): void {
    const clients = this.clientsByUserId.get(userId);
    if (!clients) return;

    const deviceList: ConnectedDevice[] = [];
    const now = Date.now();

    clients.forEach((ctx) => {
      deviceList.push({
        deviceId: ctx.deviceId,
        userId,
        name: `Device ${ctx.deviceId.substring(0, 6)}`,
        deviceType: 'WEB',
        capabilities: {
          canBeSink: true,
          supportsGapless: true,
          supportedCodecs: ['audio/aac', 'audio/mp4', 'audio/mpeg'],
          maxBitrateBps: 320000,
        },
        lastSeenMs: now,
        isOnline: true,
      });
    });

    const msg: ServerMessage = {
      type: 'DEVICE_LIST_UPDATE',
      devices: deviceList,
      serverTimestampMs: now,
    };
    clients.forEach((ctx) => this.sendToSocket(ctx.socket, msg));
  }

  private sendToSocket(socket: WebSocketConnectionLike, message: ServerMessage): void {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }
}

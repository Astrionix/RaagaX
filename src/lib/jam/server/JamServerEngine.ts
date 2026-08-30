import {
  JamSession,
  JamParticipant,
  JamPermissions,
  JamQueueItem,
  JamEvent,
  JamCommand,
  JamPlaybackState,
  JamParticipantState,
  DiscoveredJam,
  JamRole,
  JamPresetName,
  JAM_PERMISSION_PRESETS,
} from '@/types/jam';
import { Song } from '@/types/music';

export interface CommandResult {
  success: boolean;
  session?: JamSession;
  event?: JamEvent;
  error?: string;
  isIdempotentReplay?: boolean;
}

type EventListener = (event: JamEvent) => void;

interface GlobalJamState {
  __raaga_jam_server_engine__?: JamServerEngine;
  __raaga_jam_sessions__?: Map<string, JamSession>;
  __raaga_jam_codes__?: Map<string, string>;
  __raaga_jam_listeners__?: Map<string, Set<EventListener>>;
  __raaga_jam_idempotency__?: Map<string, { result: CommandResult; timestamp: number }>;
}

const globalForJam = globalThis as unknown as GlobalJamState;

export class JamServerEngine {
  private sessions: Map<string, JamSession>;
  private joinCodes: Map<string, string>; // UPPERCASE joinCode -> jamId
  private eventListeners: Map<string, Set<EventListener>>;
  private idempotencyCache: Map<string, { result: CommandResult; timestamp: number }>;

  // Restricted unambiguous alphabet: excludes 0, O, 1, I, L
  private static readonly JOIN_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  private constructor() {
    if (!globalForJam.__raaga_jam_sessions__) {
      globalForJam.__raaga_jam_sessions__ = new Map();
    }
    if (!globalForJam.__raaga_jam_codes__) {
      globalForJam.__raaga_jam_codes__ = new Map();
    }
    if (!globalForJam.__raaga_jam_listeners__) {
      globalForJam.__raaga_jam_listeners__ = new Map();
    }
    if (!globalForJam.__raaga_jam_idempotency__) {
      globalForJam.__raaga_jam_idempotency__ = new Map();
    }

    this.sessions = globalForJam.__raaga_jam_sessions__;
    this.joinCodes = globalForJam.__raaga_jam_codes__;
    this.eventListeners = globalForJam.__raaga_jam_listeners__;
    this.idempotencyCache = globalForJam.__raaga_jam_idempotency__;

    // Periodic cleanup of stale idempotency tokens & inactive sessions
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.pruneStaleData(), 60000);
    }
  }

  public static getInstance(): JamServerEngine {
    if (!globalForJam.__raaga_jam_server_engine__) {
      globalForJam.__raaga_jam_server_engine__ = new JamServerEngine();
    }
    return globalForJam.__raaga_jam_server_engine__;
  }

  /**
   * Generates a 6-character human-friendly Jam ID code (e.g. JAM_749201)
   */
  public generateJamId(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `JAM_${code}`;
  }

  /**
   * Generates a 5-character short restricted-alphabet human join code (e.g. 7K29P)
   */
  public generateJoinCode(): string {
    const chars = JamServerEngine.JOIN_CODE_CHARS;
    for (let attempts = 0; attempts < 100; attempts++) {
      let code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (!this.joinCodes.has(code)) {
        return code;
      }
    }
    // Fallback: 6-char if high collision
    let fallback = '';
    for (let i = 0; i < 6; i++) {
      fallback += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return fallback;
  }

  /**
   * Resolves a user-typed join code to an active JamSession (case-insensitive)
   */
  public resolveJoinCode(rawCode: string): JamSession | null {
    if (!rawCode) return null;
    const cleanCode = rawCode.trim().toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, '');
    const jamId = this.joinCodes.get(cleanCode);
    if (!jamId) return null;
    return this.getSession(jamId);
  }

  /**
   * Retrieves all currently active and nearby/subnet discoverable Jams
   */
  public getDiscoverableJams(clientSubnet?: string): DiscoveredJam[] {
    const discovered: DiscoveredJam[] = [];
    const now = Date.now();

    for (const session of this.sessions.values()) {
      // Exclude empty or dead sessions
      const participantCount = Object.keys(session.participants).length;
      if (participantCount === 0) continue;
      if (session.isNearbyDiscoverable === false) continue;

      discovered.push({
        jamId: session.jamId,
        joinCode: session.joinCode,
        name: session.name,
        hostName: session.hostName,
        currentSongTitle: session.currentSong?.title,
        currentSongArtist: session.currentSong?.artist,
        currentSongCover: session.currentSong?.coverUrl,
        participantCount,
        discoveryMethod: clientSubnet ? 'subnet' : 'wifi',
        signalStrength: Math.floor(Math.random() * 30) + 70, // 70-100%
        discoveredAt: now,
      });
    }

    return discovered;
  }

  /**
   * Creates a new authoritative Jam Session
   */
  public createSession(params: {
    hostId: string;
    hostName: string;
    hostAvatar?: string;
    jamName?: string;
    initialSong?: Song | null;
    initialQueue?: Song[];
    deviceType?: 'mobile' | 'desktop' | 'web';
    isNearbyDiscoverable?: boolean;
  }): { session: JamSession; event: JamEvent } {
    const jamId = this.generateJamId();
    const joinCode = this.generateJoinCode();
    const now = Date.now();

    const defaultPermissions: JamPermissions = {
      ...JAM_PERMISSION_PRESETS.CHILL_PARTY,
    };

    const hostParticipant: JamParticipant = {
      participantId: `P_${params.hostId}_${now.toString(36)}`,
      userId: params.hostId,
      displayName: params.hostName || 'Host',
      avatarUrl: params.hostAvatar,
      role: 'HOST',
      isHost: true,
      status: 'READY',
      joinedAt: now,
      lastSeenAt: now,
      clockOffsetMs: 0,
      rttMs: 20,
      playbackDriftMs: 0,
      deviceType: params.deviceType || 'web',
      isReadyForPlayback: true,
    };

    const initialQueueItems: JamQueueItem[] = (params.initialQueue || []).map((song, idx) => ({
      queueItemId: `QI_${crypto.randomUUID()}`,
      trackId: song.id,
      song,
      addedBy: params.hostId,
      addedByName: params.hostName || 'Host',
      addedByAvatar: params.hostAvatar,
      addedAt: now + idx,
      orderKey: `${(idx + 1) * 1000}`,
    }));

    const session: JamSession = {
      jamId,
      joinCode,
      name: params.jamName || `${params.hostName}'s Jam`,
      hostId: params.hostId,
      hostName: params.hostName,
      isNearbyDiscoverable: params.isNearbyDiscoverable !== false,
      state: params.initialSong ? 'PAUSED' : 'PAUSED',
      trackId: params.initialSong?.id || null,
      currentSong: params.initialSong || null,
      positionMs: 0,
      serverTimestamp: now,
      startAtServerTime: now,
      leadTimeMs: 400,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      permissions: defaultPermissions,
      participants: {
        [params.hostId]: hostParticipant,
      },
      queue: initialQueueItems,
      history: [],
    };

    this.sessions.set(jamId, session);
    this.joinCodes.set(joinCode, jamId);

    const event: JamEvent = {
      eventId: `EV_${crypto.randomUUID()}`,
      jamId,
      type: 'SESSION_CREATED',
      revision: 1,
      serverTimestamp: now,
      senderId: params.hostId,
      payload: { session },
    };

    this.broadcastEvent(jamId, event);
    return { session, event };
  }

  /**
   * Retrieves an authoritative session snapshot by ID
   */
  public getSession(jamId: string): JamSession | null {
    const session = this.sessions.get(jamId);
    if (!session) return null;
    return this.cloneSession(session);
  }

  /**
   * Joins a user into a Jam
   */
  public joinSession(
    jamId: string,
    user: {
      userId: string;
      displayName: string;
      avatarUrl?: string;
      deviceType?: 'mobile' | 'desktop' | 'web';
    }
  ): { success: boolean; session?: JamSession; error?: string } {
    const session = this.sessions.get(jamId);
    if (!session) {
      return { success: false, error: 'Jam session not found or has ended' };
    }

    const now = Date.now();
    const isExisting = Boolean(session.participants[user.userId]);

    const participant: JamParticipant = {
      participantId: isExisting
        ? session.participants[user.userId].participantId
        : `P_${user.userId}_${now.toString(36)}`,
      userId: user.userId,
      displayName: user.displayName || 'Participant',
      avatarUrl: user.avatarUrl,
      role: isExisting
        ? session.participants[user.userId].role
        : session.hostId === user.userId
        ? 'HOST'
        : 'GUEST',
      isHost: session.hostId === user.userId,
      status: 'SYNCING',
      joinedAt: isExisting ? session.participants[user.userId].joinedAt : now,
      lastSeenAt: now,
      clockOffsetMs: 0,
      rttMs: 50,
      playbackDriftMs: 0,
      deviceType: user.deviceType || 'web',
      isReadyForPlayback: false,
    };

    session.participants[user.userId] = participant;
    session.updatedAt = now;
    session.revision += 1;

    // Recalculate dynamic lead time based on connected participants
    session.leadTimeMs = this.computeAdaptiveLeadTime(session);

    const event: JamEvent = {
      eventId: `EV_${crypto.randomUUID()}`,
      jamId,
      type: 'PARTICIPANT_JOINED',
      revision: session.revision,
      serverTimestamp: now,
      senderId: user.userId,
      payload: { participant, revision: session.revision },
    };

    this.broadcastEvent(jamId, event);
    return { success: true, session: this.cloneSession(session) };
  }

  /**
   * Updates participant presence and telemetry state without altering playback or queue
   */
  public updateParticipantState(
    jamId: string,
    userId: string,
    state: Partial<JamParticipant>
  ): { success: boolean; session?: JamSession; error?: string } {
    const session = this.sessions.get(jamId);
    if (!session) return { success: false, error: 'Session not found' };

    const participant = session.participants[userId];
    if (!participant) return { success: false, error: 'Participant not in session' };

    const now = Date.now();
    Object.assign(participant, state, { lastSeenAt: now });
    session.updatedAt = now;

    const event: JamEvent = {
      eventId: `EV_${crypto.randomUUID()}`,
      jamId,
      type: 'PARTICIPANT_STATE_CHANGED',
      revision: session.revision,
      serverTimestamp: now,
      senderId: userId,
      payload: { participant: { ...participant } },
    };

    this.broadcastEvent(jamId, event);
    return { success: true, session: this.cloneSession(session) };
  }

  /**
   * Graceful departure of a participant, handling host transfer if required
   */
  public leaveSession(
    jamId: string,
    userId: string
  ): { success: boolean; sessionEnded?: boolean; error?: string } {
    const session = this.sessions.get(jamId);
    if (!session) return { success: false, error: 'Session not found' };

    const now = Date.now();
    delete session.participants[userId];
    session.updatedAt = now;
    session.revision += 1;

    const remainingUserIds = Object.keys(session.participants);

    // If no participants remain, clean up session
    if (remainingUserIds.length === 0) {
      this.sessions.delete(jamId);
      const endEvent: JamEvent = {
        eventId: `EV_${crypto.randomUUID()}`,
        jamId,
        type: 'SESSION_ENDED',
        revision: session.revision,
        serverTimestamp: now,
        senderId: userId,
        payload: { reason: 'All participants left' },
      };
      this.broadcastEvent(jamId, endEvent);
      return { success: true, sessionEnded: true };
    }

    // If host left, transfer ownership to moderator first, or longest-standing participant
    if (session.hostId === userId) {
      const moderators = remainingUserIds.filter(
        (id) => session.participants[id].role === 'MODERATOR'
      );

      let nextHostId = remainingUserIds[0];
      if (moderators.length > 0) {
        moderators.sort(
          (a, b) => session.participants[a].joinedAt - session.participants[b].joinedAt
        );
        nextHostId = moderators[0];
      } else {
        remainingUserIds.sort(
          (a, b) => session.participants[a].joinedAt - session.participants[b].joinedAt
        );
        nextHostId = remainingUserIds[0];
      }

      session.hostId = nextHostId;
      session.hostName = session.participants[nextHostId].displayName;
      session.participants[nextHostId].isHost = true;
      session.participants[nextHostId].role = 'HOST';

      const transferEvent: JamEvent = {
        eventId: `EV_${crypto.randomUUID()}`,
        jamId,
        type: 'HOST_TRANSFERRED',
        revision: session.revision,
        serverTimestamp: now,
        senderId: 'SYSTEM',
        payload: {
          newHostId: nextHostId,
          newHostName: session.hostName,
          previousHostId: userId,
          revision: session.revision,
        },
      };
      this.broadcastEvent(jamId, transferEvent);
    }

    const leaveEvent: JamEvent = {
      eventId: `EV_${crypto.randomUUID()}`,
      jamId,
      type: 'PARTICIPANT_LEFT',
      revision: session.revision,
      serverTimestamp: now,
      senderId: userId,
      payload: { userId, revision: session.revision },
    };

    this.broadcastEvent(jamId, leaveEvent);
    return { success: true };
  }

  /**
   * Executes a state-changing playback or queue command with permission & idempotency checks
   */
  public executeCommand(command: JamCommand): CommandResult {
    // 1. Idempotency check: if already processed, return cached outcome
    if (command.requestId) {
      const cached = this.idempotencyCache.get(command.requestId);
      if (cached && (Date.now() - cached.timestamp) < 30000) {
        return { ...cached.result, isIdempotentReplay: true };
      }
    }

    const session = this.sessions.get(command.jamId);
    if (!session) {
      return { success: false, error: 'Jam session not found' };
    }

    // 2. Validate participant membership
    const participant = session.participants[command.userId];
    if (!participant && command.action !== 'END_SESSION') {
      return { success: false, error: 'User is not a member of this Jam session' };
    }

    // 3. Validate permissions
    const permCheck = this.validatePermission(session, command);
    if (!permCheck.allowed) {
      return { success: false, error: permCheck.reason };
    }

    const now = Date.now();
    let eventType: JamEvent['type'] = 'SESSION_UPDATED';
    let payload: any = {};

    switch (command.action) {
      case 'PLAY': {
        const leadTime = this.computeAdaptiveLeadTime(session);
        const scheduledStart = now + leadTime;
        session.state = 'PLAYING';
        session.startAtServerTime = scheduledStart;
        session.serverTimestamp = now;
        session.leadTimeMs = leadTime;

        if (typeof command.payload?.positionMs === 'number') {
          session.positionMs = Math.max(0, command.payload.positionMs);
        }

        eventType = 'PLAY';
        payload = {
          state: 'PLAYING',
          positionMs: session.positionMs,
          startAtServerTime: session.startAtServerTime,
          trackId: session.trackId,
        };
        break;
      }

      case 'PAUSE': {
        // Calculate exact authoritative position at pause time
        const currentPos = this.calculateCurrentAuthoritativePosition(session, now);
        session.state = 'PAUSED';
        session.positionMs = currentPos;
        session.serverTimestamp = now;
        session.startAtServerTime = now;

        eventType = 'PAUSE';
        payload = {
          state: 'PAUSED',
          positionMs: session.positionMs,
          serverTimestamp: now,
          trackId: session.trackId,
        };
        break;
      }

      case 'SEEK': {
        const rawTargetMs = command.payload?.positionMs ?? 0;
        const songDurationMs = session.currentSong?.duration ? session.currentSong.duration * 1000 : Infinity;
        const targetMs = Math.max(0, Math.min(songDurationMs, rawTargetMs));
        const leadTime = this.computeAdaptiveLeadTime(session);
        const timelineId = `TL_${crypto.randomUUID()}`;

        session.positionMs = targetMs;
        session.serverTimestamp = now;
        session.leadTimeMs = leadTime;

        if (session.state === 'PLAYING') {
          session.startAtServerTime = now + leadTime;
        } else {
          session.startAtServerTime = now;
        }

        eventType = 'SEEK';
        payload = {
          positionMs: session.positionMs,
          startAtServerTime: session.startAtServerTime,
          state: session.state,
          trackId: session.trackId,
          timelineId,
        };
        break;
      }

      case 'SKIP_NEXT': {
        const leadTime = this.computeAdaptiveLeadTime(session);
        const timelineId = `TL_${crypto.randomUUID()}`;

        if (session.queue.length === 0) {
          // If queue is empty, restart current track from 0:00
          session.positionMs = 0;
          session.serverTimestamp = now;
          session.leadTimeMs = leadTime;
          if (session.state === 'PLAYING') {
            session.startAtServerTime = now + leadTime;
          } else {
            session.startAtServerTime = now;
          }
          eventType = 'SEEK';
          payload = {
            positionMs: 0,
            startAtServerTime: session.startAtServerTime,
            state: session.state,
            trackId: session.trackId,
            timelineId,
          };
          break;
        }

        const nextItem = session.queue.shift()!;
        if (session.currentSong) {
          session.history.unshift({
            queueItemId: `QI_HIST_${crypto.randomUUID()}`,
            trackId: session.currentSong.id,
            song: session.currentSong,
            addedBy: session.hostId,
            addedByName: session.hostName,
            addedAt: now,
            orderKey: '0',
          });
          if (session.history.length > 50) session.history.pop();
        }

        session.currentSong = nextItem.song;
        session.trackId = nextItem.song.id;
        session.positionMs = 0;
        session.serverTimestamp = now;
        session.leadTimeMs = leadTime;

        if (session.state === 'PLAYING') {
          session.startAtServerTime = now + leadTime;
        } else {
          session.startAtServerTime = now;
        }

        eventType = 'TRACK_CHANGED';
        payload = {
          currentSong: session.currentSong,
          trackId: session.trackId,
          positionMs: 0,
          startAtServerTime: session.startAtServerTime,
          state: session.state,
          queue: session.queue,
          timelineId,
        };
        break;
      }

      case 'SKIP_PREV': {
        const leadTime = this.computeAdaptiveLeadTime(session);
        const timelineId = `TL_${crypto.randomUUID()}`;

        if (session.history.length === 0) {
          // Restart current track at 0
          session.positionMs = 0;
          session.serverTimestamp = now;
          session.leadTimeMs = leadTime;
          if (session.state === 'PLAYING') {
            session.startAtServerTime = now + leadTime;
          } else {
            session.startAtServerTime = now;
          }
          eventType = 'SEEK';
          payload = {
            positionMs: 0,
            startAtServerTime: session.startAtServerTime,
            state: session.state,
            trackId: session.trackId,
            timelineId,
          };
          break;
        }

        const prevItem = session.history.shift()!;
        if (session.currentSong) {
          session.queue.unshift({
            queueItemId: `QI_${crypto.randomUUID()}`,
            trackId: session.currentSong.id,
            song: session.currentSong,
            addedBy: session.hostId,
            addedByName: session.hostName,
            addedAt: now,
            orderKey: '500',
          });
        }

        session.currentSong = prevItem.song;
        session.trackId = prevItem.song.id;
        session.positionMs = 0;
        session.serverTimestamp = now;
        session.leadTimeMs = leadTime;

        if (session.state === 'PLAYING') {
          session.startAtServerTime = now + leadTime;
        } else {
          session.startAtServerTime = now;
        }

        eventType = 'TRACK_CHANGED';
        payload = {
          currentSong: session.currentSong,
          trackId: session.trackId,
          positionMs: 0,
          startAtServerTime: session.startAtServerTime,
          state: session.state,
          queue: session.queue,
          timelineId,
        };
        break;
      }

      case 'ADD_TRACK': {
        const song: Song = command.payload?.song;
        if (!song || !song.id) {
          return { success: false, error: 'Invalid song payload' };
        }

        const playNow = Boolean(command.payload?.playNow);
        const orderKey = command.payload?.orderKey || `${(session.queue.length + 1) * 1000}`;
        const queueItem: JamQueueItem = {
          queueItemId: `QI_${crypto.randomUUID()}`,
          trackId: song.id,
          song,
          addedBy: command.userId,
          addedByName: participant?.displayName || 'Participant',
          addedByAvatar: participant?.avatarUrl,
          addedAt: now,
          orderKey,
        };

        if (playNow || (!session.currentSong && session.queue.length === 0)) {
          if (session.currentSong && playNow) {
            session.history.unshift({
              queueItemId: `QI_HIST_${crypto.randomUUID()}`,
              trackId: session.currentSong.id,
              song: session.currentSong,
              addedBy: session.hostId,
              addedByName: session.hostName,
              addedAt: now,
              orderKey: '0',
            });
            if (session.history.length > 50) session.history.pop();
          }

          const leadTime = this.computeAdaptiveLeadTime(session);
          const timelineId = `TL_${crypto.randomUUID()}`;
          session.currentSong = song;
          session.trackId = song.id;
          session.positionMs = 0;
          session.serverTimestamp = now;
          session.leadTimeMs = leadTime;
          session.state = 'PLAYING';
          session.startAtServerTime = now + leadTime;

          eventType = 'TRACK_CHANGED';
          payload = {
            currentSong: session.currentSong,
            trackId: session.trackId,
            positionMs: 0,
            startAtServerTime: session.startAtServerTime,
            state: session.state,
            queue: session.queue,
            timelineId,
          };
        } else {
          session.queue.push(queueItem);
          eventType = 'QUEUE_ITEM_ADDED';
          payload = { item: queueItem, queue: session.queue, currentSong: session.currentSong };
        }
        break;
      }

      case 'REMOVE_TRACK': {
        const queueItemId = command.payload?.queueItemId;
        if (!queueItemId) return { success: false, error: 'Missing queueItemId' };

        const prevLen = session.queue.length;
        session.queue = session.queue.filter((q) => q.queueItemId !== queueItemId);

        if (session.queue.length === prevLen) {
          return { success: false, error: 'Queue item not found' };
        }

        eventType = 'QUEUE_ITEM_REMOVED';
        payload = { queueItemId, queue: session.queue };
        break;
      }

      case 'REORDER_QUEUE': {
        const newQueue: JamQueueItem[] = command.payload?.queue;
        if (!Array.isArray(newQueue)) {
          return { success: false, error: 'Invalid queue array' };
        }

        session.queue = newQueue;
        eventType = 'QUEUE_REORDERED';
        payload = { queue: session.queue };
        break;
      }

      case 'UPDATE_PERMISSIONS': {
        if (session.hostId !== command.userId) {
          return { success: false, error: 'Only the host can modify permissions' };
        }
        session.permissions = {
          ...session.permissions,
          ...command.payload?.permissions,
        };
        eventType = 'PERMISSIONS_UPDATED';
        payload = { permissions: session.permissions };
        break;
      }

      case 'TRANSFER_HOST': {
        if (session.hostId !== command.userId) {
          return { success: false, error: 'Only the current host can transfer host status' };
        }
        const newHostId = command.payload?.newHostId;
        if (!newHostId || !session.participants[newHostId]) {
          return { success: false, error: 'Target user is not in this Jam session' };
        }

        session.participants[session.hostId].isHost = false;
        session.hostId = newHostId;
        session.hostName = session.participants[newHostId].displayName;
        session.participants[newHostId].isHost = true;

        eventType = 'HOST_TRANSFERRED';
        payload = { newHostId, newHostName: session.hostName };
        break;
      }

      case 'KICK_PARTICIPANT': {
        if (session.hostId !== command.userId) {
          return { success: false, error: 'Only the host can remove participants' };
        }
        const targetUserId = command.payload?.targetUserId;
        if (!targetUserId || !session.participants[targetUserId]) {
          return { success: false, error: 'Target participant not found' };
        }

        delete session.participants[targetUserId];
        eventType = 'PARTICIPANT_LEFT';
        payload = { userId: targetUserId, reason: 'Kicked by host' };
        break;
      }

      case 'UPDATE_PARTICIPANT_STATUS': {
        const status: JamParticipantState = command.payload?.status;
        if (participant && status) {
          participant.status = status;
          participant.lastSeenAt = now;
          if (typeof command.payload?.clockOffsetMs === 'number') {
            participant.clockOffsetMs = command.payload.clockOffsetMs;
          }
          if (typeof command.payload?.rttMs === 'number') {
            participant.rttMs = command.payload.rttMs;
          }
          if (typeof command.payload?.playbackDriftMs === 'number') {
            participant.playbackDriftMs = command.payload.playbackDriftMs;
          }
          if (typeof command.payload?.isReadyForPlayback === 'boolean') {
            participant.isReadyForPlayback = command.payload.isReadyForPlayback;
          }
        }
        eventType = 'PARTICIPANT_STATE_CHANGED';
        payload = { participant };
        break;
      }

      case 'PROMOTE_MODERATOR': {
        if (session.hostId !== command.userId) {
          return { success: false, error: 'Only the host can promote moderators' };
        }
        const targetUserId = command.payload?.targetUserId;
        if (!targetUserId || !session.participants[targetUserId]) {
          return { success: false, error: 'Target participant not found' };
        }
        session.participants[targetUserId].role = 'MODERATOR';
        eventType = 'PARTICIPANT_STATE_CHANGED';
        payload = { participant: session.participants[targetUserId] };
        break;
      }

      case 'SET_PRESET': {
        if (session.hostId !== command.userId) {
          return { success: false, error: 'Only the host can change permission presets' };
        }
        const presetName = command.payload?.presetName as JamPresetName;
        if (presetName && JAM_PERMISSION_PRESETS[presetName]) {
          session.permissions = { ...JAM_PERMISSION_PRESETS[presetName] };
          eventType = 'PERMISSIONS_UPDATED';
          payload = { permissions: session.permissions };
        }
        break;
      }

      case 'END_SESSION': {
        if (session.hostId !== command.userId) {
          return { success: false, error: 'Only the host can end the Jam' };
        }
        this.sessions.delete(session.jamId);
        eventType = 'SESSION_ENDED';
        payload = { reason: 'Ended by host' };
        break;
      }

      default:
        return { success: false, error: `Unknown command action: ${command.action}` };
    }

    session.updatedAt = now;
    session.revision += 1;

    const event: JamEvent = {
      eventId: `EV_${crypto.randomUUID()}`,
      jamId: session.jamId,
      type: eventType,
      revision: session.revision,
      serverTimestamp: now,
      senderId: command.userId,
      payload: { ...payload, revision: session.revision },
      requestId: command.requestId,
    };

    this.broadcastEvent(session.jamId, event);

    const result: CommandResult = {
      success: true,
      session: this.cloneSession(session),
      event,
    };

    if (command.requestId) {
      this.idempotencyCache.set(command.requestId, { result, timestamp: now });
    }

    return result;
  }

  /**
   * Computes the authoritative playback position at a given server timestamp
   */
  public calculateCurrentAuthoritativePosition(session: JamSession, atServerTime: number): number {
    if (session.state !== 'PLAYING') {
      return session.positionMs;
    }

    if (atServerTime < session.startAtServerTime) {
      return session.positionMs;
    }

    const elapsedMs = atServerTime - session.startAtServerTime;
    const durationMs = session.currentSong?.duration ? session.currentSong.duration * 1000 : Infinity;
    return Math.min(durationMs, session.positionMs + elapsedMs);
  }

  /**
   * Dynamically adapts future scheduling buffer based on participant RTTs
   */
  public computeAdaptiveLeadTime(session: JamSession): number {
    const participants = Object.values(session.participants);
    if (participants.length === 0) return 400;

    let maxRtt = 0;
    for (const p of participants) {
      if (p.rttMs > maxRtt) maxRtt = p.rttMs;
    }

    // Base lead time: max RTT * 1.5 + 200ms buffer, bounded between 300ms and 1500ms
    const adaptive = Math.max(300, Math.min(1500, Math.round(maxRtt * 1.5 + 200)));
    return adaptive;
  }

  /**
   * Server-side strict permission validation
   */
  private validatePermission(
    session: JamSession,
    command: JamCommand
  ): { allowed: boolean; reason?: string } {
    // 1. Host has full permissions
    if (session.hostId === command.userId) {
      return { allowed: true };
    }

    const participant = session.participants[command.userId];

    // 2. Moderator Role & Temporary Delegation
    const hasActiveTempPerms =
      participant?.temporaryPermissionsUntil && participant.temporaryPermissionsUntil > Date.now();

    if (participant?.role === 'MODERATOR' || hasActiveTempPerms) {
      if (
        command.action === 'PLAY' ||
        command.action === 'PAUSE' ||
        command.action === 'SEEK' ||
        command.action === 'SKIP_NEXT' ||
        command.action === 'SKIP_PREV' ||
        command.action === 'ADD_TRACK' ||
        command.action === 'REMOVE_TRACK' ||
        command.action === 'REORDER_QUEUE'
      ) {
        return { allowed: true };
      }
    }

    // 3. Per-User Custom Overrides
    if (participant?.customPermissions) {
      const custom = participant.customPermissions;
      if (command.action === 'ADD_TRACK' && typeof custom.canAddSongs === 'boolean') {
        return custom.canAddSongs
          ? { allowed: true }
          : { allowed: false, reason: 'Adding tracks is disabled for your account' };
      }
      if (
        (command.action === 'PLAY' || command.action === 'PAUSE' || command.action === 'SEEK') &&
        typeof custom.canControlPlayback === 'boolean'
      ) {
        return custom.canControlPlayback
          ? { allowed: true }
          : { allowed: false, reason: 'Playback controls are disabled for your account' };
      }
    }

    // 4. Session Preset Rules
    const p = session.permissions;
    switch (command.action) {
      case 'PLAY':
      case 'PAUSE':
        return p.canControlPlayback
          ? { allowed: true }
          : { allowed: false, reason: 'Playback controls are disabled for participants' };
      case 'SEEK': {
        const canSeek = typeof p.canSeek === 'boolean' ? p.canSeek : p.canControlPlayback;
        return canSeek
          ? { allowed: true }
          : { allowed: false, reason: 'Seeking is disabled for participants' };
      }
      case 'SKIP_NEXT':
      case 'SKIP_PREV':
        return p.canSkip
          ? { allowed: true }
          : { allowed: false, reason: 'Track skipping is disabled for participants' };
      case 'ADD_TRACK':
        return p.canAddSongs
          ? { allowed: true }
          : { allowed: false, reason: 'Adding tracks is disabled for participants' };
      case 'REMOVE_TRACK':
        return p.canRemoveSongs
          ? { allowed: true }
          : { allowed: false, reason: 'Removing tracks is disabled for participants' };
      case 'REORDER_QUEUE':
        return p.canReorderQueue
          ? { allowed: true }
          : { allowed: false, reason: 'Reordering queue is disabled for participants' };
      case 'UPDATE_PERMISSIONS':
      case 'TRANSFER_HOST':
      case 'KICK_PARTICIPANT':
      case 'PROMOTE_MODERATOR':
      case 'SET_PRESET':
      case 'END_SESSION':
        return { allowed: false, reason: 'Only the host may perform this action' };
      case 'UPDATE_PARTICIPANT_STATUS':
      case 'REPORT_METRICS':
        return { allowed: true };
      default:
        return { allowed: false, reason: 'Unauthorized command' };
    }
  }

  /**
   * Subscribes to real-time events for a specific Jam ID (SSE / internal event bus)
   */
  public subscribeToSession(jamId: string, listener: EventListener): () => void {
    if (!this.eventListeners.has(jamId)) {
      this.eventListeners.set(jamId, new Set());
    }
    this.eventListeners.get(jamId)!.add(listener);

    return () => {
      const listeners = this.eventListeners.get(jamId);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.eventListeners.delete(jamId);
        }
      }
    };
  }

  /**
   * Broadcasts an event to all subscribers and Supabase Realtime channel
   */
  public broadcastEvent(jamId: string, event: JamEvent) {
    const listeners = this.eventListeners.get(jamId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (e) {
          console.error('[JamServerEngine] Error in event listener:', e);
        }
      }
    }

    // Also broadcast to Supabase Realtime channel if available
    try {
      import('@/lib/supabaseAdmin').then(({ getSupabaseAdmin }) => {
        const admin = getSupabaseAdmin();
        if (admin) {
          admin
            .channel(`jam:${jamId}`)
            .send({
              type: 'broadcast',
              event: 'jam_event',
              payload: event,
            })
            .catch(() => {});
        }
      }).catch(() => {});
    } catch {}
  }

  private cloneSession(session: JamSession): JamSession {
    return JSON.parse(JSON.stringify(session));
  }

  private pruneStaleData() {
    const now = Date.now();
    // Prune idempotency entries older than 2 minutes
    for (const [key, value] of this.idempotencyCache.entries()) {
      if (now - value.timestamp > 120000) {
        this.idempotencyCache.delete(key);
      }
    }

    // Prune dead sessions with 0 participants older than 1 hour
    for (const [jamId, session] of this.sessions.entries()) {
      if (Object.keys(session.participants).length === 0 && (now - session.updatedAt > 3600000)) {
        this.sessions.delete(jamId);
      }
    }
  }

  /**
   * For testing: clear all state
   */
  public resetForTesting() {
    this.sessions.clear();
    this.joinCodes.clear();
    this.eventListeners.clear();
    this.idempotencyCache.clear();
  }
}

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
  PlaybackHistoryEntry,
  PlaybackHistoryReason,
  JamHandoffState,
} from '@/types/jam';
import { Song } from '@/types/music';

export type JamErrorCode =
  | 'JAM_NOT_FOUND'
  | 'JAM_ENDED'
  | 'UNAUTHORIZED'
  | 'INVALID_COMMAND'
  | 'INTERNAL_ERROR';

export interface CommandResult {
  success: boolean;
  session?: JamSession;
  event?: JamEvent;
  error?: string;
  code?: JamErrorCode;
  isIdempotentReplay?: boolean;
}

type EventListener = (event: JamEvent) => void;

interface GlobalJamState {
  __raaga_jam_server_engine__?: JamServerEngine;
  __raaga_jam_sessions__?: Map<string, JamSession>;
  __raaga_jam_ended_sessions__?: Map<string, number>;
  __raaga_jam_codes__?: Map<string, string>;
  __raaga_jam_listeners__?: Map<string, Set<EventListener>>;
  __raaga_jam_idempotency__?: Map<string, { result: CommandResult; timestamp: number }>;
}

const globalForJam = globalThis as unknown as GlobalJamState;

export class JamServerEngine {
  private sessions: Map<string, JamSession>;
  private endedSessions: Map<string, number>; // jamId -> endedTimestamp
  private joinCodes: Map<string, string>; // UPPERCASE joinCode -> jamId
  private eventListeners: Map<string, Set<EventListener>>;
  private idempotencyCache: Map<string, { result: CommandResult; timestamp: number }>;

  // Restricted unambiguous alphabet: excludes 0, O, 1, I, L
  private static readonly JOIN_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  // Explicit session lifecycle rules: 24h active lifetime, 12h idle lifetime
  public static readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  public static readonly IDLE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  private constructor() {
    if (!globalForJam.__raaga_jam_sessions__) {
      globalForJam.__raaga_jam_sessions__ = new Map();
    }
    if (!globalForJam.__raaga_jam_ended_sessions__) {
      globalForJam.__raaga_jam_ended_sessions__ = new Map();
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
    this.endedSessions = globalForJam.__raaga_jam_ended_sessions__;
    this.joinCodes = globalForJam.__raaga_jam_codes__;
    this.eventListeners = globalForJam.__raaga_jam_listeners__;
    this.idempotencyCache = globalForJam.__raaga_jam_idempotency__;

    // Periodic cleanup of stale idempotency tokens & truly expired sessions
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
   * Asynchronously persists or updates the JamSession in Supabase shared storage
   */
  public async persistSessionToDb(session: JamSession): Promise<void> {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
      const admin = getSupabaseAdmin();
      if (!admin) return;

      await admin.from('jam_sessions').upsert(
        {
          jam_id: session.jamId,
          join_code: session.joinCode,
          host_id: session.hostId,
          host_name: session.hostName,
          name: session.name,
          status: session.status || 'ACTIVE',
          state: session.state,
          track_id: session.trackId,
          current_song: session.currentSong,
          position_ms: session.positionMs,
          base_position_ms: session.basePositionMs || session.positionMs,
          server_timestamp: session.serverTimestamp,
          start_at_server_time: session.startAtServerTime,
          timeline_start_server_ms: session.timelineStartServerMs || session.startAtServerTime,
          lead_time_ms: session.leadTimeMs,
          revision: session.revision,
          generation: session.generation || 1,
          timeline_id: session.timelineId || 'TL_1',
          transition_id: session.transitionId || 'TR_1',
          permissions: session.permissions,
          participants: session.participants,
          queue: session.queue,
          history: session.history,
          is_nearby_discoverable: session.isNearbyDiscoverable !== false,
          created_at: session.createdAt,
          updated_at: session.updatedAt,
          last_activity_at: session.lastActivityAt || session.updatedAt,
          expires_at: session.expiresAt || (session.updatedAt + JamServerEngine.SESSION_TTL_MS),
        },
        { onConflict: 'jam_id' }
      );
    } catch {
      // Graceful in-memory fallback if database is unconfigured or unreachable
    }
  }

  /**
   * Attempts to hydrate a session from Supabase shared storage into memory L1 cache
   */
  public async hydrateSessionFromDb(jamId: string): Promise<JamSession | null> {
    if (this.endedSessions.has(jamId)) return null;

    try {
      const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
      const admin = getSupabaseAdmin();
      if (!admin) return null;

      const { data, error } = await admin
        .from('jam_sessions')
        .select('*')
        .eq('jam_id', jamId)
        .maybeSingle();

      if (data && !error && data.status !== 'ENDED') {
        const hydrated: JamSession = {
          jamId: data.jam_id,
          joinCode: data.join_code,
          name: data.name,
          hostId: data.host_id,
          hostName: data.host_name,
          status: data.status || 'ACTIVE',
          state: data.state || 'PAUSED',
          trackId: data.track_id || null,
          currentSong: data.current_song || null,
          positionMs: Number(data.position_ms || 0),
          basePositionMs: Number(data.base_position_ms || 0),
          serverTimestamp: Number(data.server_timestamp || Date.now()),
          startAtServerTime: Number(data.start_at_server_time || Date.now()),
          timelineStartServerMs: Number(data.timeline_start_server_ms || Date.now()),
          leadTimeMs: Number(data.lead_time_ms || 400),
          revision: Number(data.revision || 1),
          generation: Number(data.generation || 1),
          timelineId: data.timeline_id || 'TL_1',
          transitionId: data.transition_id || 'TR_1',
          permissions: data.permissions || {},
          participants: data.participants || {},
          queue: data.queue || [],
          history: data.history || [],
          playbackHistory: data.playback_history || [],
          activeHandoff: data.active_handoff || null,
          isNearbyDiscoverable: data.is_nearby_discoverable !== false,
          createdAt: Number(data.created_at || Date.now()),
          updatedAt: Number(data.updated_at || Date.now()),
          lastActivityAt: Number(data.last_activity_at || Date.now()),
          expiresAt: Number(data.expires_at || (Date.now() + JamServerEngine.SESSION_TTL_MS)),
        };

        this.sessions.set(hydrated.jamId, hydrated);
        this.joinCodes.set(hydrated.joinCode, hydrated.jamId);

        console.log(`\n[JAM_FETCHED]\njamId=${hydrated.jamId}\nstatus=${hydrated.status}\nrevision=${hydrated.revision}\nsource=DATABASE_HYDRATION\n`);
        return this.cloneSession(hydrated);
      }
    } catch {}

    return null;
  }

  /**
   * Authoritative helper to record an entry in the Playback History model
   */
  private recordPlaybackHistory(
    session: JamSession,
    reason: PlaybackHistoryReason,
    now: number,
    song?: Song | null,
    queueItemId?: string | null
  ) {
    if (!session.playbackHistory) {
      session.playbackHistory = [];
    }
    const songToRecord = song ?? session.currentSong;
    const trackId = songToRecord?.id ?? session.trackId;
    if (!trackId) return;

    const entry: PlaybackHistoryEntry = {
      historyId: `HIST_${crypto.randomUUID()}`,
      queueItemId: queueItemId ?? session.currentQueueItemId ?? null,
      trackId,
      transitionId: session.transitionId || `TR_${session.generation || 1}`,
      startedAt: now,
      endedAt: now,
      reason,
      generation: session.generation || 1,
      song: songToRecord,
    };

    session.playbackHistory.unshift(entry);
    if (session.playbackHistory.length > 100) {
      session.playbackHistory.pop();
    }
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
   * Asynchronously resolves a join code with database hydration fallback
   */
  public async resolveJoinCodeAsync(rawCode: string): Promise<JamSession | null> {
    if (!rawCode) return null;
    const cleanCode = rawCode.trim().toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, '');
    const localSession = this.resolveJoinCode(cleanCode);
    if (localSession) return localSession;

    try {
      const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
      const admin = getSupabaseAdmin();
      if (!admin) return null;

      const { data, error } = await admin
        .from('jam_sessions')
        .select('jam_id')
        .eq('join_code', cleanCode)
        .maybeSingle();

      if (data?.jam_id && !error) {
        return this.getSessionAsync(data.jam_id);
      }
    } catch {}

    return null;
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
    initialQueueIndex?: number;
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

    const rawQueue = params.initialQueue || [];
    let initialQueueItems: JamQueueItem[] = [];
    let initialHistoryItems: JamQueueItem[] = [];
    let currentQueueItemId: string | null = null;

    if (params.initialSong) {
      currentQueueItemId = `QI_${crypto.randomUUID()}`;

      if (params.initialQueueIndex !== undefined && params.initialQueueIndex >= 0 && params.initialQueueIndex < rawQueue.length) {
        const activeIdx = params.initialQueueIndex;
        // Items before activeIdx become history
        initialHistoryItems = rawQueue.slice(0, activeIdx).map((song, idx) => ({
          queueItemId: `QI_HIST_${crypto.randomUUID()}`,
          trackId: song.id,
          song,
          addedBy: params.hostId,
          addedByName: params.hostName || 'Host',
          addedByAvatar: params.hostAvatar,
          addedAt: now - (activeIdx - idx) * 1000,
          orderKey: `${(idx + 1) * 1000}`,
        }));

        // Items strictly after activeIdx become upcoming queue
        initialQueueItems = rawQueue.slice(activeIdx + 1).map((song, idx) => ({
          queueItemId: `QI_${crypto.randomUUID()}`,
          trackId: song.id,
          song,
          addedBy: params.hostId,
          addedByName: params.hostName || 'Host',
          addedByAvatar: params.hostAvatar,
          addedAt: now + (idx + 1) * 1000,
          orderKey: `${(idx + 1) * 1000}`,
        }));
      } else if (rawQueue.length > 0 && rawQueue[0]?.id === params.initialSong?.id) {
        // Active item is at index 0 of rawQueue (e.g. store.queue starting with currentSong)
        initialQueueItems = rawQueue.slice(1).map((song, idx) => ({
          queueItemId: `QI_${crypto.randomUUID()}`,
          trackId: song.id,
          song,
          addedBy: params.hostId,
          addedByName: params.hostName || 'Host',
          addedByAvatar: params.hostAvatar,
          addedAt: now + (idx + 1) * 1000,
          orderKey: `${(idx + 1) * 1000}`,
        }));
      } else {
        // rawQueue is passed without initialSong at index 0 (already upcoming queue or independent list)
        initialQueueItems = rawQueue.map((song, idx) => ({
          queueItemId: `QI_${crypto.randomUUID()}`,
          trackId: song.id,
          song,
          addedBy: params.hostId,
          addedByName: params.hostName || 'Host',
          addedByAvatar: params.hostAvatar,
          addedAt: now + (idx + 1) * 1000,
          orderKey: `${(idx + 1) * 1000}`,
        }));
      }
    } else {
      initialQueueItems = rawQueue.map((song, idx) => ({
        queueItemId: `QI_${crypto.randomUUID()}`,
        trackId: song.id,
        song,
        addedBy: params.hostId,
        addedByName: params.hostName || 'Host',
        addedByAvatar: params.hostAvatar,
        addedAt: now + idx,
        orderKey: `${(idx + 1) * 1000}`,
      }));
    }

    const session: JamSession = {
      jamId,
      joinCode,
      name: params.jamName || `${params.hostName}'s Jam`,
      hostId: params.hostId,
      hostName: params.hostName,
      isNearbyDiscoverable: params.isNearbyDiscoverable !== false,
      status: 'ACTIVE',
      state: params.initialSong ? 'PAUSED' : 'PAUSED',
      trackId: params.initialSong?.id || null,
      currentQueueItemId: currentQueueItemId || (initialQueueItems[0]?.queueItemId ?? null),
      currentSong: params.initialSong || null,
      positionMs: 0,
      basePositionMs: 0,
      serverTimestamp: now,
      startAtServerTime: now,
      timelineStartServerMs: now,
      leadTimeMs: 400,
      revision: 1,
      generation: 1,
      timelineId: 'TL_1',
      transitionId: 'TR_1',
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      expiresAt: now + JamServerEngine.SESSION_TTL_MS,
      permissions: defaultPermissions,
      participants: {
        [params.hostId]: hostParticipant,
      },
      queue: initialQueueItems,
      history: initialHistoryItems,
      playbackHistory: [],
      activeHandoff: null,
    };

    if (params.initialSong) {
      this.recordPlaybackHistory(session, 'MANUAL_NEXT', now, params.initialSong, session.currentQueueItemId);
    }

    this.sessions.set(jamId, session);
    this.joinCodes.set(joinCode, jamId);
    this.persistSessionToDb(session);

    console.log(`\n[JAM_CREATED]\njamId=${jamId}\ncreatedAt=${now}\nexpiresAt=${session.expiresAt}\nstatus=ACTIVE\nhostUserId=${params.hostId}\nstorage=DATABASE_AND_MEMORY\nTTL=${JamServerEngine.SESSION_TTL_MS / 1000}s\nlastActivity=${now}\n`);

    const event: JamEvent = {
      eventId: `EV_${crypto.randomUUID()}`,
      jamId,
      type: 'SESSION_CREATED',
      revision: 1,
      generation: 1,
      timelineId: 'TL_1',
      transitionId: 'TR_1',
      serverTimestamp: now,
      senderId: params.hostId,
      payload: { session },
    };

    this.broadcastEvent(jamId, event);
    return { session, event };
  }

  /**
   * Retrieves an authoritative session snapshot by ID (synchronous L1 memory check)
   */
  public getSession(jamId: string): JamSession | null {
    const session = this.sessions.get(jamId);
    if (!session) return null;
    return this.cloneSession(session);
  }

  /**
   * Retrieves an authoritative session snapshot with asynchronous database fallback
   */
  public async getSessionAsync(jamId: string): Promise<JamSession | null> {
    const session = this.sessions.get(jamId);
    if (session) {
      return this.cloneSession(session);
    }
    return this.hydrateSessionFromDb(jamId);
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
    const isFirstParticipant = Object.keys(session.participants).length === 0;
    const shouldBeHost = isExisting
      ? session.participants[user.userId].role === 'HOST'
      : (session.hostId === user.userId || isFirstParticipant);

    if (isFirstParticipant) {
      session.hostId = user.userId;
      session.hostName = user.displayName || 'Host';
    }

    const participant: JamParticipant = {
      participantId: isExisting
        ? session.participants[user.userId].participantId
        : `P_${user.userId}_${now.toString(36)}`,
      userId: user.userId,
      displayName: user.displayName || 'Participant',
      avatarUrl: user.avatarUrl,
      role: isExisting
        ? session.participants[user.userId].role
        : (shouldBeHost ? 'HOST' : 'GUEST'),
      isHost: shouldBeHost,
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
    session.lastActivityAt = now;
    session.expiresAt = now + JamServerEngine.SESSION_TTL_MS;
    if (session.status === 'IDLE') {
      session.status = 'ACTIVE';
    }
    session.revision += 1;

    // Recalculate dynamic lead time based on connected participants
    session.leadTimeMs = this.computeAdaptiveLeadTime(session);

    this.persistSessionToDb(session);
    console.log(`\n[JAM_PARTICIPANT_CONNECTED]\njamId=${jamId}\nuserId=${user.userId}\ndisplayName=${participant.displayName}\ntimestamp=${now}\n`);

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
   * Asynchronously joins a session with database hydration fallback
   */
  public async joinSessionAsync(
    jamId: string,
    user: {
      userId: string;
      displayName: string;
      avatarUrl?: string;
      deviceType?: 'mobile' | 'desktop' | 'web';
    }
  ): Promise<{ success: boolean; session?: JamSession; error?: string }> {
    if (!this.sessions.has(jamId)) {
      await this.hydrateSessionFromDb(jamId);
    }
    return this.joinSession(jamId, user);
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
    session.lastActivityAt = now;
    session.expiresAt = now + JamServerEngine.SESSION_TTL_MS;

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
    this.persistSessionToDb(session);
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
    session.lastActivityAt = now;
    session.revision += 1;

    console.log(`\n[JAM_PARTICIPANT_DISCONNECTED]\njamId=${jamId}\nuserId=${userId}\nreason=PARTICIPANT_LEFT\ntimestamp=${now}\n`);

    const remainingUserIds = Object.keys(session.participants);

    // If no participants remain, transition session to IDLE state (DO NOT immediately destroy healthy Jam)
    if (remainingUserIds.length === 0) {
      session.status = 'IDLE';
      session.expiresAt = now + JamServerEngine.IDLE_TTL_MS;
      this.persistSessionToDb(session);

      const idleEvent: JamEvent = {
        eventId: `EV_${crypto.randomUUID()}`,
        jamId,
        type: 'PARTICIPANT_LEFT',
        revision: session.revision,
        serverTimestamp: now,
        senderId: userId,
        payload: { userId, reason: 'All participants left (Session is now IDLE)', revision: session.revision },
      };
      this.broadcastEvent(jamId, idleEvent);
      return { success: true, sessionEnded: false };
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
    const idKey = command.requestId || (command as any).commandId;
    if (idKey) {
      const cached = this.idempotencyCache.get(idKey);
      if (cached && (Date.now() - cached.timestamp) < 30000) {
        return { ...cached.result, isIdempotentReplay: true };
      }
    }

    const session = this.sessions.get(command.jamId);
    if (!session) {
      if (this.endedSessions.has(command.jamId)) {
        return { success: false, code: 'JAM_ENDED', error: 'Jam session has ended' };
      }
      return { success: false, code: 'JAM_NOT_FOUND', error: 'Jam session not found' };
    }

    // 2. Validate participant membership
    const participant = session.participants[command.userId];
    if (!participant && command.action !== 'END_SESSION') {
      return { success: false, code: 'UNAUTHORIZED', error: 'User is not a member of this Jam session' };
    }

    // 3. Validate permissions
    const permCheck = this.validatePermission(session, command);
    if (!permCheck.allowed) {
      return { success: false, code: 'INVALID_COMMAND', error: permCheck.reason };
    }

    const now = Date.now();
    const lastActivityBefore = session.lastActivityAt || session.updatedAt;
    session.lastActivityAt = now;
    session.expiresAt = now + JamServerEngine.SESSION_TTL_MS;
    if (session.status === 'IDLE' && command.action !== 'END_SESSION') {
      session.status = 'ACTIVE';
    }

    if (command.action !== 'HEARTBEAT' && command.action !== 'UPDATE_PARTICIPANT_STATUS') {
      console.log(`\n[JAM_ACTIVITY]\njamId=${session.jamId}\noperation=${command.action}\ntimestamp=${now}\nlastActivityBefore=${lastActivityBefore}\nlastActivityAfter=${now}\n`);
    }

    let eventType: JamEvent['type'] = 'SESSION_UPDATED';
    let payload: any = {};

    console.log('[COMMAND]', {
      requestId: command.requestId || 'NONE',
      revision: session.revision,
      actorId: command.userId,
      commandType: command.action,
    });

    switch (command.action) {
      case 'PLAY': {
        // Idempotency check: if already playing and position is unchanged, return without creating duplicate timeline
        if (session.state === 'PLAYING') {
          const isPositionUnspecifiedOrSame =
            typeof command.payload?.positionMs !== 'number' ||
            Math.abs(command.payload.positionMs - session.positionMs) < 100;
          if (isPositionUnspecifiedOrSame) {
            console.log(`[PLAYBACK_EFFECT] action=NO_OP reason=IDEMPOTENT_PLAY timelineId=${session.timelineId} generation=${session.generation}`);
            return { success: true, session: this.cloneSession(session), isIdempotentReplay: true };
          }
        }

        const leadTime = this.computeAdaptiveLeadTime(session);
        const scheduledStart = now + leadTime;

        // SAME-TRACK TIMELINE PROTECTION (Part 1/4):
        // PLAY (resume) of the same track does NOT increment generation.
        // Generation is only bumped for genuine track transitions (SKIP_NEXT/PREV, SEEK, STOP, ADD_TRACK).
        // Preserving generation means clients recognize this as a state-only change (PAUSED→PLAYING)
        // and do NOT reload audio or restart the track from 0.
        const currentGeneration = session.generation ?? 1;
        const timelineId = `TL_${currentGeneration}_${crypto.randomUUID().slice(0, 6)}`;
        const transitionId = `TR_${currentGeneration}_${crypto.randomUUID().slice(0, 6)}`;

        session.state = 'PLAYING';
        session.startAtServerTime = scheduledStart;
        session.timelineStartServerMs = scheduledStart;
        session.serverTimestamp = now;
        session.leadTimeMs = leadTime;
        session.timelineId = timelineId;
        session.transitionId = transitionId;

        if (typeof command.payload?.positionMs === 'number') {
          session.positionMs = Math.max(0, command.payload.positionMs);
        }
        session.basePositionMs = session.positionMs;

        eventType = 'PLAY';
        payload = {
          state: 'PLAYING',
          positionMs: session.positionMs,
          basePositionMs: session.basePositionMs,
          startAtServerTime: session.startAtServerTime,
          timelineStartServerMs: session.timelineStartServerMs,
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          timelineId,
          transitionId,
          generation: currentGeneration,
          isPureResume: true,
        };

        console.log('[PLAYBACK_STARTED]', {
          jamId: session.jamId,
          requestId: command.requestId || 'NONE',
          revision: session.revision,
          trackId: session.trackId,
          queueItemId: session.currentQueueItemId,
          transitionId,
          timelineId,
          generation: currentGeneration,
          deviceId: command.deviceId || command.userId,
          state: session.state,
          position: session.positionMs,
          isPureResume: true,
        });

        console.log(`[PLAYBACK_RESUMED] trackId=${session.trackId} position=${session.positionMs} timelineId=${session.timelineId} revision=${session.revision}`);
        console.log('[PLAYBACK]', {
          trackId: session.trackId,
          timelineId,
          transitionId,
          generation: currentGeneration,
          state: session.state,
          isPureResume: true,
        });
        break;
      }

      case 'PAUSE': {
        // Idempotency check: if already paused, return without creating duplicate timeline
        if (session.state === 'PAUSED') {
          console.log(`[PLAYBACK_EFFECT] action=NO_OP reason=IDEMPOTENT_PAUSE timelineId=${session.timelineId} generation=${session.generation}`);
          return { success: true, session: this.cloneSession(session), isIdempotentReplay: true };
        }

        // Calculate exact authoritative position at pause time
        const currentPos = this.calculateCurrentAuthoritativePosition(session, now);

        // SAME-TRACK TIMELINE PROTECTION (Part 1/4):
        // PAUSE of the same track does NOT increment generation.
        // The exact pause position is preserved in positionMs and basePositionMs.
        // Clients recognize same generation+trackId → state-only reconciliation (PLAYING→PAUSED).
        // No audio reload, no seek to 0, no new track identity.
        const currentGeneration = session.generation ?? 1;
        const timelineId = `TL_${currentGeneration}_${crypto.randomUUID().slice(0, 6)}`;
        const transitionId = `TR_${currentGeneration}_${crypto.randomUUID().slice(0, 6)}`;

        session.state = 'PAUSED';
        session.positionMs = currentPos;
        session.basePositionMs = currentPos;
        session.serverTimestamp = now;
        session.startAtServerTime = now;
        session.timelineStartServerMs = now;
        session.timelineId = timelineId;
        session.transitionId = transitionId;

        eventType = 'PAUSE';
        payload = {
          state: 'PAUSED',
          positionMs: session.positionMs,
          basePositionMs: session.basePositionMs,
          serverTimestamp: now,
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          timelineId,
          transitionId,
          generation: currentGeneration,
          isPureResume: false,
        };

        console.log(`[PLAYBACK_PAUSED] trackId=${session.trackId} position=${session.positionMs} timelineId=${session.timelineId} revision=${session.revision}`);
        console.log('[PLAYBACK]', {
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          timelineId,
          transitionId,
          generation: currentGeneration,
          state: session.state,
          isPureResume: false,
        });
        break;
      }

      case 'STOP': {
        // Idempotency check: if already paused at 0:00, return without duplicate
        if (session.state === 'PAUSED' && session.positionMs === 0) {
          console.log(`[PLAYBACK_EFFECT] action=NO_OP reason=IDEMPOTENT_STOP timelineId=${session.timelineId} generation=${session.generation}`);
          return { success: true, session: this.cloneSession(session), isIdempotentReplay: true };
        }

        session.generation = (session.generation ?? 0) + 1;
        const timelineId = `TL_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;
        const transitionId = `TR_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;

        session.state = 'PAUSED';
        session.positionMs = 0;
        session.basePositionMs = 0;
        session.serverTimestamp = now;
        session.startAtServerTime = now;
        session.timelineStartServerMs = now;
        session.timelineId = timelineId;
        session.transitionId = transitionId;

        this.recordPlaybackHistory(session, 'STOP', now);

        eventType = 'STOP';
        payload = {
          state: 'PAUSED',
          positionMs: 0,
          basePositionMs: 0,
          serverTimestamp: now,
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          timelineId,
          transitionId,
          generation: session.generation,
        };

        console.log('[PLAYBACK]', {
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          timelineId,
          transitionId,
          generation: session.generation,
          state: session.state,
        });
        break;
      }

      case 'SEEK': {
        const rawTargetMs = command.payload?.positionMs ?? 0;
        const songDurationMs = session.currentSong?.duration ? session.currentSong.duration * 1000 : Infinity;
        const targetMs = Math.max(0, Math.min(songDurationMs, rawTargetMs));
        const leadTime = this.computeAdaptiveLeadTime(session);
        session.generation = (session.generation ?? 0) + 1;
        const timelineId = `TL_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;
        const transitionId = `TR_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;

        session.positionMs = targetMs;
        session.basePositionMs = targetMs;
        session.serverTimestamp = now;
        session.leadTimeMs = leadTime;
        session.timelineId = timelineId;
        session.transitionId = transitionId;

        if (session.state === 'PLAYING') {
          session.startAtServerTime = now + leadTime;
        } else {
          session.startAtServerTime = now;
        }
        session.timelineStartServerMs = session.startAtServerTime;

        eventType = 'SEEK';
        payload = {
          positionMs: session.positionMs,
          basePositionMs: session.basePositionMs,
          startAtServerTime: session.startAtServerTime,
          timelineStartServerMs: session.timelineStartServerMs,
          state: session.state,
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          timelineId,
          transitionId,
          generation: session.generation,
        };

        console.log('[PLAYBACK]', {
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          timelineId,
          transitionId,
          generation: session.generation,
          state: session.state,
        });
        break;
      }

      case 'SKIP_NEXT': {
        const leadTime = this.computeAdaptiveLeadTime(session);
        session.generation = (session.generation ?? 0) + 1;
        const timelineId = `TL_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;
        const transitionId = `TR_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;

        if (session.queue.length === 0) {
          // If queue is empty, restart current track from 0:00
          session.positionMs = 0;
          session.basePositionMs = 0;
          session.serverTimestamp = now;
          session.leadTimeMs = leadTime;
          session.timelineId = timelineId;
          session.transitionId = transitionId;

          if (session.state === 'PLAYING') {
            session.startAtServerTime = now + leadTime;
          } else {
            session.startAtServerTime = now;
          }
          session.timelineStartServerMs = session.startAtServerTime;

          eventType = 'SEEK';
          payload = {
            positionMs: 0,
            basePositionMs: 0,
            startAtServerTime: session.startAtServerTime,
            timelineStartServerMs: session.timelineStartServerMs,
            state: session.state,
            trackId: session.trackId,
            currentQueueItemId: session.currentQueueItemId,
            timelineId,
            transitionId,
            generation: session.generation,
          };
          break;
        }

        const oldQueueItemId = session.currentQueueItemId;
        const nextItem = session.queue.shift()!;
        if (session.currentSong) {
          session.history.unshift({
            queueItemId: session.currentQueueItemId || `QI_HIST_${crypto.randomUUID()}`,
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
        session.currentQueueItemId = nextItem.queueItemId;
        session.positionMs = 0;
        session.basePositionMs = 0;
        session.serverTimestamp = now;
        session.leadTimeMs = leadTime;
        session.timelineId = timelineId;
        session.transitionId = transitionId;

        if (session.state === 'PLAYING') {
          session.startAtServerTime = now + leadTime;
        } else {
          session.startAtServerTime = now;
        }
        session.timelineStartServerMs = session.startAtServerTime;

        this.recordPlaybackHistory(session, 'MANUAL_NEXT', now, session.currentSong, session.currentQueueItemId);

        console.log(`[SKIP_NEXT] fromQueueItem=${oldQueueItemId} toQueueItem=${session.currentQueueItemId} transitionId=${session.transitionId} revision=${session.revision}`);

        eventType = 'TRACK_CHANGED';
        payload = {
          currentSong: session.currentSong,
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          positionMs: 0,
          basePositionMs: 0,
          startAtServerTime: session.startAtServerTime,
          timelineStartServerMs: session.timelineStartServerMs,
          state: session.state,
          queue: session.queue,
          history: session.history,
          playbackHistory: session.playbackHistory,
          timelineId,
          transitionId,
          generation: session.generation,
        };

        console.log('[TRANSITION]', {
          requestId: command.requestId || 'NONE',
          transitionId,
          fromTrackId: session.history[0]?.trackId,
          toTrackId: session.trackId,
          queueItemId: session.currentQueueItemId,
        });

        console.log('[PLAYBACK]', {
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          timelineId,
          transitionId,
          generation: session.generation,
          state: session.state,
        });
        break;
      }

      case 'SKIP_PREV': {
        const currentPos = this.calculateCurrentAuthoritativePosition(session, now);
        const leadTime = this.computeAdaptiveLeadTime(session);
        session.generation = (session.generation ?? 0) + 1;
        const timelineId = `TL_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;
        const transitionId = `TR_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;

        const hasHistory = (session.playbackHistory && session.playbackHistory.length > 1) || session.history.length > 0;

        // If played > 3s or no history, restart current song at 0:00
        if (currentPos > 3000 || !hasHistory) {
          session.positionMs = 0;
          session.basePositionMs = 0;
          session.serverTimestamp = now;
          session.leadTimeMs = leadTime;
          session.timelineId = timelineId;
          session.transitionId = transitionId;

          if (session.state === 'PLAYING') {
            session.startAtServerTime = now + leadTime;
          } else {
            session.startAtServerTime = now;
          }
          session.timelineStartServerMs = session.startAtServerTime;

          eventType = 'SEEK';
          payload = {
            positionMs: 0,
            basePositionMs: 0,
            startAtServerTime: session.startAtServerTime,
            timelineStartServerMs: session.timelineStartServerMs,
            state: session.state,
            trackId: session.trackId,
            currentQueueItemId: session.currentQueueItemId,
            timelineId,
            transitionId,
            generation: session.generation,
          };
          break;
        }

        // Use PlaybackHistory model if available for true non-linear history step-back
        let prevSong: Song | null = null;
        let prevQueueItemId: string | null = null;

        if (session.playbackHistory && session.playbackHistory.length > 1) {
          session.playbackHistory.shift(); // Remove current
          const prevEntry = session.playbackHistory[0];
          prevSong = prevEntry.song || null;
          prevQueueItemId = prevEntry.queueItemId;
        } else if (session.history.length > 0) {
          const prevItem = session.history.shift()!;
          prevSong = prevItem.song;
          prevQueueItemId = prevItem.queueItemId;
        }

        if (!prevSong) {
          session.positionMs = 0;
          eventType = 'SEEK';
          payload = { positionMs: 0, state: session.state };
          break;
        }

        if (session.currentSong) {
          session.queue.unshift({
            queueItemId: session.currentQueueItemId || `QI_${crypto.randomUUID()}`,
            trackId: session.currentSong.id,
            song: session.currentSong,
            addedBy: session.hostId,
            addedByName: session.hostName,
            addedAt: now,
            orderKey: '500',
          });
        }

        session.currentSong = prevSong;
        session.trackId = prevSong.id;
        session.currentQueueItemId = prevQueueItemId;
        session.positionMs = 0;
        session.basePositionMs = 0;
        session.serverTimestamp = now;
        session.leadTimeMs = leadTime;
        session.timelineId = timelineId;
        session.transitionId = transitionId;

        if (session.state === 'PLAYING') {
          session.startAtServerTime = now + leadTime;
        } else {
          session.startAtServerTime = now;
        }
        session.timelineStartServerMs = session.startAtServerTime;

        eventType = 'TRACK_CHANGED';
        payload = {
          currentSong: session.currentSong,
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          positionMs: 0,
          basePositionMs: 0,
          startAtServerTime: session.startAtServerTime,
          timelineStartServerMs: session.timelineStartServerMs,
          state: session.state,
          queue: session.queue,
          history: session.history,
          playbackHistory: session.playbackHistory,
          timelineId,
          transitionId,
          generation: session.generation,
        };

        console.log('[TRANSITION]', {
          requestId: command.requestId || 'NONE',
          transitionId,
          reason: 'MANUAL_PREVIOUS',
          toTrackId: session.trackId,
          queueItemId: session.currentQueueItemId,
        });

        console.log('[PLAYBACK]', {
          trackId: session.trackId,
          currentQueueItemId: session.currentQueueItemId,
          timelineId,
          transitionId,
          generation: session.generation,
          state: session.state,
        });
        break;
      }

      case 'REQUEST_HANDOFF': {
        const targetUserId = command.payload?.targetUserId;
        const targetParticipant = targetUserId ? session.participants[targetUserId] : null;
        if (!targetParticipant) {
          return { success: false, error: 'Target participant not found in this Jam' };
        }

        const currentPos = this.calculateCurrentAuthoritativePosition(session, now);
        const handoffId = `HO_${crypto.randomUUID()}`;
        const handoffState: JamHandoffState = {
          handoffId,
          sourceDeviceId: command.deviceId || command.userId,
          sourceUserId: command.userId,
          targetDeviceId: command.payload?.targetDeviceId || targetUserId,
          targetUserId,
          trackId: session.trackId || '',
          queueItemId: session.currentQueueItemId || null,
          transitionId: session.transitionId || `TR_${session.generation || 1}`,
          timelineId: session.timelineId || `TL_${session.generation || 1}`,
          generation: session.generation || 1,
          revision: session.revision,
          status: 'HANDOFF_REQUESTED',
          positionMs: currentPos,
          requestedAt: now,
        };

        session.activeHandoff = handoffState;
        eventType = 'HANDOFF_REQUESTED';
        payload = { handoff: handoffState };

        console.log('[HANDOFF]', {
          jamId: session.jamId,
          requestId: command.requestId || 'NONE',
          handoffId,
          sourceUserId: command.userId,
          targetUserId,
          status: 'HANDOFF_REQUESTED',
          positionMs: currentPos,
        });
        break;
      }

      case 'CONFIRM_HANDOFF_READY': {
        if (!session.activeHandoff || session.activeHandoff.handoffId !== command.payload?.handoffId) {
          return { success: false, error: 'No matching active handoff request' };
        }

        const leadTime = this.computeAdaptiveLeadTime(session);
        session.generation = (session.generation ?? 0) + 1;
        const timelineId = `TL_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;
        const transitionId = `TR_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;

        const targetPosMs = session.activeHandoff.positionMs || 0;
        session.positionMs = targetPosMs;
        session.basePositionMs = targetPosMs;
        session.serverTimestamp = now;
        session.startAtServerTime = now + leadTime;
        session.timelineStartServerMs = session.startAtServerTime;
        session.leadTimeMs = leadTime;
        session.timelineId = timelineId;
        session.transitionId = transitionId;
        session.state = 'PLAYING';

        session.activeHandoff.status = 'HANDOFF_COMMITTED';
        session.activeHandoff.committedAt = now;
        session.activeHandoff.timelineId = timelineId;
        session.activeHandoff.transitionId = transitionId;
        session.activeHandoff.generation = session.generation;

        this.recordPlaybackHistory(session, 'HANDOFF', now);

        eventType = 'HANDOFF_COMMITTED';
        payload = {
          handoff: session.activeHandoff,
          positionMs: session.positionMs,
          basePositionMs: session.basePositionMs,
          startAtServerTime: session.startAtServerTime,
          timelineStartServerMs: session.timelineStartServerMs,
          timelineId,
          transitionId,
          generation: session.generation,
          state: 'PLAYING',
        };

        console.log('[HANDOFF]', {
          jamId: session.jamId,
          requestId: command.requestId || 'NONE',
          handoffId: session.activeHandoff.handoffId,
          status: 'HANDOFF_COMMITTED',
          positionMs: session.positionMs,
          timelineId,
          transitionId,
        });
        break;
      }

      case 'CONFIRM_TARGET_PLAYING': {
        if (session.activeHandoff) {
          session.activeHandoff.status = 'TARGET_PLAYING';
          eventType = 'HANDOFF_COMPLETED';
          payload = { handoff: session.activeHandoff };
        }
        break;
      }

      case 'FAIL_HANDOFF': {
        if (session.activeHandoff) {
          session.activeHandoff.status = 'HANDOFF_FAILED';
          session.activeHandoff.errorMessage = command.payload?.errorMessage || 'Handoff failed on target device';
          eventType = 'HANDOFF_FAILED';
          payload = { handoff: session.activeHandoff, reason: session.activeHandoff.errorMessage };
          session.activeHandoff = null;
        }
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
              queueItemId: session.currentQueueItemId || `QI_HIST_${crypto.randomUUID()}`,
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
          session.generation = (session.generation ?? 0) + 1;
          const timelineId = `TL_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;
          const transitionId = `TR_${session.generation}_${crypto.randomUUID().slice(0, 6)}`;

          session.currentSong = song;
          session.trackId = song.id;
          session.currentQueueItemId = queueItem.queueItemId;
          session.positionMs = 0;
          session.basePositionMs = 0;
          session.serverTimestamp = now;
          session.leadTimeMs = leadTime;
          session.state = 'PLAYING';
          session.startAtServerTime = now + leadTime;
          session.timelineStartServerMs = session.startAtServerTime;
          session.timelineId = timelineId;
          session.transitionId = transitionId;

          eventType = 'TRACK_CHANGED';
          payload = {
            currentSong: session.currentSong,
            trackId: session.trackId,
            currentQueueItemId: session.currentQueueItemId,
            positionMs: 0,
            basePositionMs: 0,
            startAtServerTime: session.startAtServerTime,
            timelineStartServerMs: session.timelineStartServerMs,
            state: session.state,
            queue: session.queue,
            history: session.history,
            timelineId,
            transitionId,
            generation: session.generation,
          };

          console.log('[PLAYBACK]', {
            trackId: session.trackId,
            currentQueueItemId: session.currentQueueItemId,
            timelineId,
            transitionId,
            generation: session.generation,
            state: session.state,
          });
        } else {
          session.queue.push(queueItem);
          eventType = 'QUEUE_ITEM_ADDED';
          // NOTE: Do NOT include currentSong here even if non-null.
          // TRACK_CHANGED is the sole authoritative event for loading a new current track.
          // Including currentSong in QUEUE_ITEM_ADDED causes clients to double-load the audio source.
          payload = { item: queueItem, queue: session.queue };
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
        if (participant) {
          if (status) {
            participant.status = status;
          }
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

      case 'HEARTBEAT': {
        if (participant) {
          participant.lastSeenAt = now;
          if (command.payload?.status) {
            participant.status = command.payload.status;
          }
          if (typeof command.payload?.clockOffsetMs === 'number') {
            participant.clockOffsetMs = command.payload.clockOffsetMs;
          }
          if (typeof command.payload?.rttMs === 'number') {
            participant.rttMs = command.payload.rttMs;
          }
          if (typeof command.payload?.playbackDriftMs === 'number') {
            participant.playbackDriftMs = command.payload.playbackDriftMs;
          }
        }
        eventType = 'HEARTBEAT';
        payload = { userId: command.userId, lastSeenAt: now };
        console.log(`\n[JAM_HEARTBEAT]\njamId=${session.jamId}\nparticipantId=${command.userId}\ntimestamp=${now}\n`);
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
          return { success: false, code: 'INVALID_COMMAND', error: 'Only the host can end the Jam' };
        }
        session.status = 'ENDED';
        this.sessions.delete(session.jamId);
        this.endedSessions.set(session.jamId, now);
        this.joinCodes.delete(session.joinCode);
        eventType = 'SESSION_ENDED';
        payload = { reason: 'Ended by host' };

        console.log(`\n[JAM_ENDED]\njamId=${session.jamId}\nreason=EXPLICIT_HOST_END\ntimestamp=${now}\ndestroyedBy=${command.userId}\n`);
        console.log(`\n[JAM_DESTROYED]\njamId=${session.jamId}\nreason=EXPLICIT_HOST_END\ncaller=${command.userId}\ntimestamp=${now}\ncreatedAt=${session.createdAt}\nexpiresAt=${session.expiresAt}\nlastActivity=${session.lastActivityAt}\ndestroyedBy=${command.userId}\n`);
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
    this.persistSessionToDb(session);

    const result: CommandResult = {
      success: true,
      session: this.cloneSession(session),
      event,
    };

    if (idKey) {
      this.idempotencyCache.set(idKey, { result, timestamp: now });
    }

    return result;
  }

  /**
   * Asynchronously executes a state-changing command with database hydration fallback
   */
  public async executeCommandAsync(command: JamCommand): Promise<CommandResult> {
    if (!this.sessions.has(command.jamId)) {
      await this.hydrateSessionFromDb(command.jamId);
    }
    return this.executeCommand(command);
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
  /**
   * Dynamically adapts future scheduling buffer based on:
   * 1. Minimum lead time (350ms)
   * 2. Network safety margin (max RTT * 1.5 + jitter margin)
   * 3. Measured audio decoder preparation latency (220ms) + safety buffer
   */
  public computeAdaptiveLeadTime(session: JamSession): number {
    const participants = Object.values(session.participants);
    if (participants.length === 0) return 400;

    let maxRtt = 0;
    for (const p of participants) {
      if (p.rttMs && p.rttMs > maxRtt) maxRtt = p.rttMs;
    }

    const MINIMUM_LEAD_MS = 350;
    const ESTIMATED_AUDIO_PREP_MS = 220; // Average mobile/desktop audio decoder readiness time
    const JITTER_SAFETY_BUFFER_MS = 200;

    const networkSafetyMargin = maxRtt > 0 ? Math.round(maxRtt * 1.5 + JITTER_SAFETY_BUFFER_MS) : MINIMUM_LEAD_MS;
    const preparationSafetyMargin = ESTIMATED_AUDIO_PREP_MS + 80;

    const adaptive = Math.max(MINIMUM_LEAD_MS, networkSafetyMargin, preparationSafetyMargin);
    return Math.min(1500, adaptive);
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
      case 'STOP':
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
      case 'HEARTBEAT':
      case 'REPORT_METRICS':
      case 'REQUEST_HANDOFF':
      case 'CONFIRM_HANDOFF_READY':
      case 'CONFIRM_TARGET_PLAYING':
      case 'FAIL_HANDOFF':
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

    // Prune truly expired sessions (after 24 hours of inactivity)
    for (const [jamId, session] of this.sessions.entries()) {
      const isExpired = session.expiresAt
        ? now > session.expiresAt
        : (now - (session.lastActivityAt || session.updatedAt) > JamServerEngine.SESSION_TTL_MS);

      if (isExpired) {
        session.status = 'ENDED';
        this.sessions.delete(jamId);
        this.endedSessions.set(jamId, now);
        this.joinCodes.delete(session.joinCode);
        this.persistSessionToDb(session);

        console.log(`\n[JAM_EXPIRED]\njamId=${jamId}\nreason=IDLE_TIMEOUT\ntimestamp=${now}\ncreatedAt=${session.createdAt}\nexpiresAt=${session.expiresAt}\nlastActivityAt=${session.lastActivityAt || session.updatedAt}\n`);

        console.log(`\n[JAM_DESTROYED]\njamId=${jamId}\nreason=IDLE_TIMEOUT\ncaller=CLEANUP_JOB\ntimestamp=${now}\ncreatedAt=${session.createdAt}\nexpiresAt=${session.expiresAt}\nlastActivity=${session.lastActivityAt || session.updatedAt}\ndestroyedBy=SYSTEM\n`);
      }
    }
  }

  public isSessionEnded(jamId: string): boolean {
    return this.endedSessions.has(jamId);
  }

  /**
   * For testing: clear all state
   */
  public resetForTesting() {
    this.sessions.clear();
    this.endedSessions.clear();
    this.joinCodes.clear();
    this.eventListeners.clear();
    this.idempotencyCache.clear();
  }
}

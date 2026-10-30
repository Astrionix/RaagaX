import { create } from 'zustand';
import { config } from '@/config';
import { ytAuthSnapshot } from '@/extension/useYtAuth';
import { ServerClock } from './clock';
import { cleanCode, CODE_LENGTH, isLocalAddress, parseCodeAndServer, sanitizeServerUrl } from './invite';
import {
  EMPTY_PLAYBACK,
  EMPTY_QUEUE,
  memberOf,
  playbackOf,
  queueOf,
  snapshotOf,
  type JoinRequest,
  type PartyActivity,
  type PartyMember,
  type PartyMembership,
  type PartyPlayback,
  type PartyPreview,
  type PartyQueue,
  type PartyTrack,
} from './models';

/**
 * Listen Together, the client half (ListenTogether.kt): membership, the
 * socket, the clock, and the controls any member may send. It doesn't touch
 * the player. What it publishes is [partyPositionMs], where this device ought
 * to be right now; partySync.ts binds that to the player.
 *
 * Nothing acts on "play now". The server holds a position and the server time
 * it was true at; [clock] measures this device's offset; the playhead is
 * arithmetic. Sequence numbers drop stale states, the server re-states the
 * truth every few seconds, and the socket loop assumes the socket will die.
 *
 * Unlike the phone, a reload doesn't end the party: the code and token are
 * kept for the tab's session (sessionStorage), and the reconnect lands inside
 * the server's 45 s grace, so a refresh is invisible to everyone else.
 */

/** All default Render party servers with fallback support. */
export const DEFAULT_SERVERS: string[] = [
  sanitizeServerUrl(config.partyServerUrl),
  ...config.partyBackupServerUrls.map(sanitizeServerUrl),
].filter((url): url is string => !!url && url.length > 0);

/** Primary default server (first in pool). */
export const DEFAULT_SERVER = DEFAULT_SERVERS[0] ?? 'https://raagax.onrender.com';
export const MAX_UPCOMING = 25;
const PING_INTERVAL_MS = 15_000;
const REPORT_INTERVAL_MS = 10_000;
const KICK_BLOCK_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_LIMIT = 100;
/** Failed connects in a row before asking the server whether the membership still exists. */
const CHECK_AFTER_FAILURES = 3;
const UNREACHABLE = 'Couldn’t reach the party server.';

export type Connection = 'offline' | 'connecting' | 'live';

export interface PartyState {
  code: string | null;
  you: PartyMember | null;
  members: PartyMember[];
  maxMembers: number;
  hostOnlyControl: boolean;
  playback: PartyPlayback;
  /** Held apart from [playback] because it arrives apart; replaced only when it changed. */
  queue: PartyQueue;
  connection: Connection;
  /** False until the first round trip; the playhead is a guess until then. */
  clockSynced: boolean;
  roundTripMs: number;
  error: string | null;
  /** The last 100 actions this session. */
  activity: PartyActivity[];
  /** A resume this device accepted but may not perform yet (partySync owns it). */
  awaitingStart: boolean;
}

const IDLE: PartyState = {
  code: null,
  you: null,
  members: [],
  maxMembers: 5,
  hostOnlyControl: false,
  playback: EMPTY_PLAYBACK,
  queue: EMPTY_QUEUE,
  connection: 'offline',
  clockSynced: false,
  roundTripMs: 0,
  error: null,
  activity: [],
  awaitingStart: false,
};

export const useParty = create<PartyState>()(() => IDLE);

/** True for a listener in a party whose host has taken control of it. */
export function controlsLocked(state: PartyState = useParty.getState()): boolean {
  return !!state.code && state.hostOnlyControl && state.you?.isHost !== true;
}

export class PartyError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// ---- Settings: the server, a nickname -------------------------------------------------

const SETTINGS_KEY = 'raaga:party';
const SESSION_KEY = 'raaga:party-session';

interface Settings {
  customServer: string;
  nickname: string;
}

export function partySettings(): Settings {
  try {
    return { customServer: '', nickname: '', ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { customServer: '', nickname: '' };
  }
}

export function savePartySettings(change: Partial<Settings>): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...partySettings(), ...change }));
}

let effectiveIdleServer: string = DEFAULT_SERVER;

/**
 * Resolves candidate servers in priority order:
 * 1. Custom user server (if set)
 * 2. Preferred server (e.g. from invite link)
 * 3. Currently active/healthy idle server
 * 4. All configured default Render servers (primary and backups)
 */
export function serverCandidates(preferredBase?: string | null): string[] {
  const candidates: string[] = [];
  const add = (url: string | null | undefined) => {
    const clean = sanitizeServerUrl(url);
    if (clean && !candidates.includes(clean)) candidates.push(clean);
  };

  add(preferredBase);
  add(partySettings().customServer);

  // Local Wi-Fi Jam candidates for instant LAN connection
  const lastLocal = localStorage.getItem('raaga:lastLocalJamHost');
  if (lastLocal) add(lastLocal);
  add('http://localhost:8890');
  add('http://127.0.0.1:8890');

  add(effectiveIdleServer);
  for (const s of DEFAULT_SERVERS) {
    add(s);
  }
  return candidates;
}

/** The server parties are made on: the custom one if set, else the active healthy Render server. */
export function idleServer(): string {
  const custom = partySettings().customServer;
  if (custom) return sanitizeServerUrl(custom) ?? DEFAULT_SERVER;
  return effectiveIdleServer;
}

/** Probes the Render server pool and updates effectiveIdleServer to the first healthy one. */
export async function probeHealthyServer(): Promise<string> {
  const custom = sanitizeServerUrl(partySettings().customServer);
  if (custom) return custom;
  for (const s of DEFAULT_SERVERS) {
    try {
      const res = await fetch(`${s}/healthz`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        effectiveIdleServer = s;
        return s;
      }
    } catch {
      // try next fallback candidate
    }
  }
  return DEFAULT_SERVER;
}

// ---- Membership --------------------------------------------------------------------

let token: string | null = null;
let server: string | null = null;
export const clock = new ServerClock();

function deviceId(): string {
  let id = localStorage.getItem('raaga:deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('raaga:deviceId', id);
  }
  return id;
}

async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Who this device jams as: the YouTube Music account it's signed in with
 * (prompt §8; the phone requires a signed-in account too). The id is a hash of
 * the login and channel, never either of them.
 */
async function identity(): Promise<Omit<JoinRequest, 'maxMembers' | 'autoplayEnabled'>> {
  const auth = ytAuthSnapshot();
  const active = auth.signedIn ? auth.active : null;
  const devId = deviceId();
  const name =
    partySettings().nickname.trim() ||
    active?.name ||
    `Web Listener ${devId.slice(-4).toUpperCase()}`;

  const userId = active
    ? (await sha256(`${active.authUser}:${active.id}`)).slice(0, 32)
    : `usr_${devId.slice(-6).toLowerCase()}`;

  return {
    userId,
    deviceId: devId,
    displayName: name,
    avatarUrl: active?.avatarUrl?.startsWith('http') ? active.avatarUrl : null,
  };
}

async function errorOf(response: Response): Promise<PartyError> {
  const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
  return new PartyError(
    body?.error || `http_${response.status}`,
    body?.message || (response.status === 422 ? 'This account can’t be used to jam.' : `The party server said ${response.status}.`),
    response.status,
  );
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  } catch {
    // 1. Fallback via Companion Extension bridge if installed and direct browser fetch was blocked by CORS
    try {
      const { detectExtension } = await import('@raaga/shared/bridge');
      const { config } = await import('@/config');
      const ext = await detectExtension({ chromiumExtensionId: config.chromiumExtensionId, timeoutMs: 1200 });
      if (ext?.bridge) {
        const bridgeRes = await ext.bridge.call('addon.fetch', {
          url,
          method: (init.method as 'GET' | 'POST') || 'GET',
          headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
          body: typeof init.body === 'string' ? init.body : undefined,
        });
        if (bridgeRes.status >= 200 && bridgeRes.status < 300) {
          return JSON.parse(bridgeRes.body) as T;
        }
        throw new PartyError(
          `http_${bridgeRes.status}`,
          bridgeRes.status === 422 ? 'This account can’t be used to jam.' : `The party server said ${bridgeRes.status}.`,
          bridgeRes.status,
        );
      }
    } catch (bridgeErr) {
      if (bridgeErr instanceof PartyError) throw bridgeErr;
    }
    throw new PartyError('unreachable', UNREACHABLE);
  }
  if (!response.ok) throw await errorOf(response);
  return (await response.json()) as T;
}

function adoptMembership(base: string, membership: PartyMembership): string {
  token = membership.token;
  server = base;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: membership.code, token, server }));
  clock.reset();
  const party = snapshotOf(membership.party);
  useParty.setState({
    ...IDLE,
    code: membership.code,
    you: memberOf(membership.you),
    members: party.members,
    maxMembers: party.maxMembers,
    hostOnlyControl: party.hostOnlyControl,
    playback: party.playback,
    queue: party.queue,
    connection: 'connecting',
    activity: useParty.getState().activity,
  });
  connect();
  return membership.code;
}

export async function createParty(options: { maxMembers?: number; autoplayEnabled: boolean }): Promise<string> {
  if (useParty.getState().code) await leaveParty();
  const candidates = serverCandidates(idleServer());
  let lastError: unknown = null;
  const payload = JSON.stringify({ ...(await identity()), maxMembers: options.maxMembers ?? 5, autoplayEnabled: options.autoplayEnabled });

  for (const base of candidates) {
    try {
      const membership = await request<PartyMembership>(`${base}/api/parties`, {
        method: 'POST',
        body: payload,
      });
      effectiveIdleServer = base;
      return adoptMembership(base, membership);
    } catch (error) {
      lastError = error;
      console.warn(`[ListenTogether] createParty failed on ${base}, attempting fallback...`, error);
    }
  }
  const err = (lastError as Error) ?? new PartyError('no_server', UNREACHABLE);
  useParty.setState({ error: messageOf(err) });
  throw err;
}

/**
 * Joins [code], on [serverUrl] when an invite named one. Target first, as
 * switchPartyWithRecovery does: the party this device is already in is only
 * given up once the new one has said yes.
 * Automatically attempts fallback across all 3 Render servers if unguided.
 */
export async function joinParty(rawCode: string, serverUrl?: string | null): Promise<string> {
  const { code, serverUrl: parsedServer } = parseCodeAndServer(rawCode);
  if (!code) throw new PartyError('bad_code', `A party code is ${CODE_LENGTH} letters or digits.`);
  refuseIfRecentlyKicked(code);
  const targetServer = serverUrl || parsedServer;
  if (targetServer && isLocalAddress(new URL(targetServer).hostname)) {
    localStorage.setItem('raaga:lastLocalJamHost', targetServer);
  }
  const candidates = serverCandidates(targetServer);
  const current = useParty.getState();
  let lastError: unknown = null;
  const payload = JSON.stringify(await identity());

  for (const base of candidates) {
    if (current.code === code && server === base) return code;
    try {
      const membership = await request<PartyMembership>(`${base}/api/parties/${code}/join`, {
        method: 'POST',
        body: payload,
      });
      const previous = current.code && token && server ? { code: current.code, token, server } : null;
      disconnect();
      if (previous) void releaseSlot(previous.server, previous.code, previous.token);
      effectiveIdleServer = base;
      return adoptMembership(base, membership);
    } catch (error) {
      lastError = error;
      console.warn(`[ListenTogether] joinParty failed on ${base}, attempting fallback...`, error);
    }
  }
  const err = (lastError as Error) ?? new PartyError('not_found', 'Party not found.');
  useParty.setState({ error: messageOf(err) });
  throw err;
}

export async function previewParty(rawCode: string, serverUrl?: string | null): Promise<PartyPreview> {
  const { code, serverUrl: parsedServer } = parseCodeAndServer(rawCode);
  if (!code) throw new PartyError('bad_code', `A party code is ${CODE_LENGTH} letters or digits.`);
  refuseIfRecentlyKicked(code);
  const targetServer = serverUrl || parsedServer;
  const candidates = serverCandidates(targetServer);
  let lastError: unknown = null;

  for (const base of candidates) {
    try {
      return await request<PartyPreview>(`${base}/api/parties/${code}/preview`);
    } catch (error) {
      lastError = error;
      if (error instanceof PartyError && error.code === 'http_404') {
        continue;
      }
    }
  }
  if (lastError instanceof PartyError && lastError.code === 'http_404') {
    return { code, hostName: '', memberCount: 0, maxMembers: 5, isFull: false, members: [] };
  }
  throw (lastError as Error) ?? new PartyError('not_found', 'Party not found.');
}

function releaseSlot(base: string, code: string, held: string): Promise<void> {
  return fetch(`${base}/api/parties/${code}/leave`, { method: 'POST', headers: { Authorization: `Bearer ${held}` } })
    .then(() => undefined)
    .catch(() => undefined);
}

export async function leaveParty(): Promise<void> {
  const { code } = useParty.getState();
  const held = token;
  const base = server;
  disconnect();
  token = null;
  server = null;
  sessionStorage.removeItem(SESSION_KEY);
  clock.reset();
  useParty.setState({ ...IDLE, activity: useParty.getState().activity });
  if (code && held && base) await releaseSlot(base, code, held);
}

/** Picks a party back up after a reload, inside the server's grace period. */
export function resumeSession(): void {
  if (useParty.getState().code) return;
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as { code: string; token: string; server: string } | null;
    if (!saved?.code || !saved.token || !saved.server) return;
    token = saved.token;
    server = saved.server;
    useParty.setState({ ...IDLE, code: saved.code, connection: 'connecting' });
    connect();
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export function partyServer(): string | null {
  return server;
}

// ---- Recent kicks (a door that stays shut on this device for a day) ------------------------

const KICKS_KEY = 'raaga:party-kicked';

function recentKicks(): Record<string, number> {
  try {
    const all = JSON.parse(localStorage.getItem(KICKS_KEY) ?? '{}') as Record<string, number>;
    return Object.fromEntries(Object.entries(all).filter(([, until]) => until > Date.now()));
  } catch {
    return {};
  }
}

function recordKick(code: string): void {
  localStorage.setItem(KICKS_KEY, JSON.stringify({ ...recentKicks(), [code]: Date.now() + KICK_BLOCK_MS }));
}

function refuseIfRecentlyKicked(code: string): void {
  if (recentKicks()[code]) throw new PartyError('kicked', 'You were removed from this party. You can rejoin tomorrow.');
}

// ---- Controls (any member, unless the host has taken control) -------------------------------

let socket: WebSocket | null = null;

function send(frame: Record<string, unknown>): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
}

function control(action: string, body: Record<string, unknown> = {}): void {
  send({ type: 'control', action, ...body });
}

export const party = {
  play: (positionMs?: number) => control('play', positionMs !== undefined ? { positionMs: Math.round(positionMs) } : {}),
  pause: (positionMs?: number) => control('pause', positionMs !== undefined ? { positionMs: Math.round(positionMs) } : {}),
  seek: (positionMs: number) => control('seek', { positionMs: Math.round(positionMs) }),
  next: () => control('next'),
  previous: () => control('previous'),
  setTrack: (track: PartyTrack, positionMs = 0, isPlaying = true) =>
    control('setTrack', { track, positionMs: Math.round(positionMs), isPlaying }),
  setQueue: (queue: PartyTrack[], index: number) => control('setQueue', { queue, queueIndex: index }),
  queueAdd: (tracks: PartyTrack[], playNext = false) => control('queueAdd', { tracks, playNext }),
  queueRemove: (videoId: string) => control('queueRemove', { videoId }),
  queueClear: () => control('queueClear'),
  queueMove: (fromIndex: number, toIndex: number, videoId?: string) =>
    control('queueMove', { fromIndex, toIndex, ...(videoId && { videoId }) }),
  setMaxMembers: (maxMembers: number) => control('setMaxMembers', { maxMembers }),
  kick: (memberId: string) => control('kick', { memberId }),
  setAutoplay: (enabled: boolean) => control('setAutoplay', { enabled }),
  setHostOnlyControl: (enabled: boolean) => control('setHostOnlyControl', { enabled }),
};

// ---- The playhead ------------------------------------------------------------------

/**
 * Where this device should be in the current track, right now, in ms; null
 * without a track. Before the first pong it's the server's own reading at send
 * time: a starting point, not a thing to seek to (wait for clockSynced).
 */
export function partyPositionMs(): number | null {
  const { playback } = useParty.getState();
  const track = playback.track;
  if (!track) return null;
  if (!playback.isPlaying) return playback.positionMs;
  const serverNow = clock.serverNowMs();
  if (serverNow === null) return playback.effectivePositionMs;
  const position = playback.positionMs + Math.max(0, serverNow - playback.anchorMs);
  return track.durationMs ? Math.min(position, track.durationMs) : position;
}

/** How far ahead the party's next resume is scheduled (the play lead), or 0 if it's under way. */
export function msUntilStart(): number {
  const { playback } = useParty.getState();
  if (!playback.isPlaying) return 0;
  const serverNow = clock.serverNowMs();
  return serverNow === null ? 0 : Math.max(0, playback.anchorMs - serverNow);
}

// ---- The socket ----------------------------------------------------------------------

let loopId = 0;
let timers: ReturnType<typeof setTimeout>[] = [];

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function disconnect(): void {
  loopId++;
  clearTimers();
  const s = socket;
  socket = null;
  if (s && s.readyState <= WebSocket.OPEN) s.close(1000, 'left');
}

/** Connect, pump frames until the socket goes, back off with jitter, go round again. */
function connect(): void {
  disconnect();
  const id = ++loopId;
  let backoff = 1000;
  let failures = 0;

  const open = () => {
    const { code } = useParty.getState();
    if (id !== loopId || !code || !token || !server) return;
    useParty.setState({ connection: 'connecting' });
    const ws = new WebSocket(`${server.replace(/^http/, 'ws')}/ws/parties/${code}`, ['raaga.v1', `raaga.token.${token}`]);
    socket = ws;
    let opened = false;
    ws.onopen = () => {
      if (id !== loopId) return;
      opened = true;
      failures = 0;
      backoff = 1000;
      useParty.setState({ connection: 'live', error: null });
      // A burst on arrival makes the first seconds accurate, then a trickle keeps up with drift.
      for (let i = 0; i < 4; i++) timers.push(setTimeout(ping, i * 300));
      timers.push(setInterval(ping, PING_INTERVAL_MS) as unknown as ReturnType<typeof setTimeout>);
      timers.push(setInterval(report, REPORT_INTERVAL_MS) as unknown as ReturnType<typeof setTimeout>);
    };
    ws.onmessage = (event) => {
      if (id === loopId) onFrame(String(event.data));
    };
    ws.onclose = () => {
      if (id !== loopId || socket !== ws) return;
      socket = null;
      clearTimers();
      clock.reset();
      useParty.setState({ connection: 'connecting', clockSynced: false });
      if (!opened && ++failures >= CHECK_AFTER_FAILURES) {
        failures = 0;
        void checkMembership();
      }
      const wait = backoff / 2 + Math.random() * (backoff + 1);
      backoff = Math.min(backoff * 2, 30_000);
      timers.push(setTimeout(open, wait));
    };
  };
  open();
}

/**
 * A browser can't read why a handshake failed, so after a few failed opens
 * the server is asked whether this membership still exists. A party the
 * server has forgotten (a restart, a sweep) is left rather than redialled forever.
 */
async function checkMembership(): Promise<void> {
  const { code } = useParty.getState();
  if (!code || !token || !server) return;
  try {
    const response = await fetch(`${server}/api/parties/${code}`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401 || response.status === 404) {
      const why = await errorOf(response);
      await leaveParty();
      useParty.setState({ error: why.status === 404 ? 'That party has ended.' : why.message });
    }
  } catch {
    // Unreachable: keep trying.
  }
}

function ping(): void {
  send({ type: 'ping', clientMs: clock.nowMs() });
}

function report(): void {
  const position = partyPositionMs();
  if (position === null) return;
  send({ type: 'report', positionMs: Math.round(position), isPlaying: useParty.getState().playback.isPlaying });
}

function recordActivity(entry: PartyActivity): void {
  useParty.setState((s) => ({ activity: [entry, ...s.activity].slice(0, ACTIVITY_LIMIT) }));
}

function onFrame(text: string): void {
  const received = clock.nowMs();
  let frame: Record<string, unknown>;
  try {
    frame = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return;
  }
  const state = useParty.getState();
  switch (frame.type) {
    case 'welcome': {
      if (!frame.party) return;
      const party = snapshotOf(frame.party as never);
      useParty.setState({
        code: party.code || state.code,
        you: frame.you ? memberOf(frame.you as never) : state.you,
        members: party.members,
        maxMembers: party.maxMembers,
        hostOnlyControl: party.hostOnlyControl,
        playback: party.playback,
        // The one message that always carries the queue: a new arrival has no other way to learn it.
        queue: party.queue,
        connection: 'live',
        error: null,
      });
      break;
    }
    case 'pong': {
      const sentAt = Number(frame.clientMs);
      const serverMs = Number(frame.serverMs);
      if (!Number.isFinite(sentAt) || !Number.isFinite(serverMs)) return;
      clock.record(sentAt, serverMs, received);
      useParty.setState({ clockSynced: clock.synced, roundTripMs: clock.roundTripMs });
      break;
    }
    case 'state': {
      const playback = playbackOf(frame.playback as never);
      // Older than what's applied: two controllers pressing at once settle instead of fighting.
      if (playback.seq < state.playback.seq) return;
      useParty.setState({ playback });
      // A missed queue frame is healed on the next heartbeat rather than lived with.
      if (playback.queueSeq !== useParty.getState().queue.seq) send({ type: 'syncQueue' });
      break;
    }
    case 'queue': {
      const queue = queueOf(frame.queue as never);
      if (queue.seq < state.queue.seq) return;
      useParty.setState({ queue });
      break;
    }
    case 'members': {
      const members = ((frame.members as unknown[]) ?? []).map((m) => memberOf(m as never));
      const maxMembers = typeof frame.maxMembers === 'number' ? frame.maxMembers : state.maxMembers;
      // Absent on an older server: keep what's held, so an upgrade doesn't silently unlock a party.
      const hostOnlyControl = typeof frame.hostOnlyControl === 'boolean' ? frame.hostOnlyControl : state.hostOnlyControl;
      // The only place a promotion is announced.
      const you = (state.you && members.find((m) => m.memberId === state.you!.memberId)) ?? state.you;
      useParty.setState({ members, maxMembers, hostOnlyControl, you });
      break;
    }
    case 'activity': {
      const action = typeof frame.action === 'string' ? frame.action : null;
      const by = typeof frame.by === 'string' && frame.by ? frame.by : null;
      if (!action || !by) return;
      recordActivity({ action, by, atMs: typeof frame.atMs === 'number' ? frame.atMs : Date.now(), detail: String(frame.detail ?? '') });
      break;
    }
    case 'error': {
      const reason = String(frame.error ?? '');
      useParty.setState({ error: typeof frame.message === 'string' ? frame.message : reason });
      // Terminal: the party no longer knows this device.
      if (reason === 'bad_token' || reason === 'no_such_party') void leaveParty();
      break;
    }
    case 'bye': {
      if (frame.reason === 'kicked' && state.code) recordKick(state.code);
      const kicked = frame.reason === 'kicked';
      void leaveParty().then(() => kicked && useParty.setState({ error: 'The host removed you from the party.' }));
      break;
    }
  }
}

export function messageOf(error: unknown): string {
  return error instanceof PartyError ? error.message : UNREACHABLE;
}

export const QUEUE_EMPTY = EMPTY_QUEUE;

export interface LocalJamInfo {
  host: string;
  code?: string;
  members?: number;
  maxMembers?: number;
}

/** Probes local Wi-Fi / LAN endpoints for any actively hosted Jam session. */
export async function probeLocalJam(hostHint?: string, codeFilter?: string): Promise<LocalJamInfo | null> {
  const probeHosts: string[] = [];
  const add = (h: string | null | undefined) => {
    const clean = sanitizeServerUrl(h);
    if (clean && !probeHosts.includes(clean)) probeHosts.push(clean);
  };

  add(hostHint);
  add(localStorage.getItem('raaga:lastLocalJamHost'));
  add('http://localhost:8890');
  add('http://127.0.0.1:8890');
  add('http://192.168.43.1:8890'); // standard Android Wi-Fi hotspot gateway

  for (const host of probeHosts) {
    try {
      const res = await fetch(`${host}/api/parties/active`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; code?: string; members?: number; maxMembers?: number };
        if (data.ok) {
          if (!codeFilter || !data.code || data.code.toUpperCase() === codeFilter.toUpperCase()) {
            localStorage.setItem('raaga:lastLocalJamHost', host);
            return {
              host,
              code: data.code,
              members: data.members,
              maxMembers: data.maxMembers,
            };
          }
        }
      }
    } catch {
      // not answering on this local host
    }
  }
  return null;
}

export interface NearbyJam {
  host: string;
  code: string;
  hostName: string;
  members: number;
  maxMembers: number;
  title?: string;
  artist?: string;
  thumbnailUrl?: string;
  isPlaying?: boolean;
}

interface NearbyJamsStore {
  nearbyJams: NearbyJam[];
  isScanning: boolean;
  lastScannedAt: number;
  scan: () => Promise<NearbyJam[]>;
}

/**
 * Discovers any active Jam sessions running on the local Wi-Fi / LAN across
 * Android, Desktop, or other PCs on the same network.
 */
export const useNearbyJams = create<NearbyJamsStore>((set, get) => ({
  nearbyJams: [],
  isScanning: false,
  lastScannedAt: 0,
  scan: async () => {
    if (get().isScanning) return get().nearbyJams;
    set({ isScanning: true });
    try {
      const results: NearbyJam[] = [];
      const hostsSeen = new Set<string>();

      const checkHost = async (host: string) => {
        const clean = sanitizeServerUrl(host);
        if (!clean || hostsSeen.has(clean)) return;
        hostsSeen.add(clean);
        try {
          const res = await fetch(`${clean}/api/parties/active`, { signal: AbortSignal.timeout(800) });
          if (res.ok) {
            const data = (await res.json()) as {
              ok?: boolean;
              code?: string;
              hostName?: string;
              members?: number;
              maxMembers?: number;
              title?: string;
              artist?: string;
              thumbnailUrl?: string;
              isPlaying?: boolean;
            };
            if (data && data.ok && data.code) {
              const jam: NearbyJam = {
                host: clean,
                code: data.code.toUpperCase(),
                hostName: data.hostName || 'Nearby Device',
                members: data.members ?? 1,
                maxMembers: data.maxMembers ?? 5,
                title: data.title || undefined,
                artist: data.artist || undefined,
                thumbnailUrl: data.thumbnailUrl || undefined,
                isPlaying: data.isPlaying ?? true,
              };
              results.push(jam);
              set({ nearbyJams: [...results] });
            }
          }
        } catch {
          // host offline or unreachable
        }
      };

      // 0. Discover via Render backend over internet (and same-network public IP matching)
      try {
        const renderServer = idleServer();
        const res = await fetch(`${renderServer}/api/parties/discover`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = (await res.json()) as {
            parties?: Array<{
              code: string;
              hostName: string;
              memberCount: number;
              maxMembers: number;
              track?: { title?: string; artist?: string; thumbnailUrl?: string };
              isPlaying?: boolean;
              sameNetwork?: boolean;
            }>;
          };
          if (data && Array.isArray(data.parties)) {
            for (const p of data.parties) {
              if (p && p.code && !results.some((r) => r.code === p.code.toUpperCase())) {
                results.push({
                  host: renderServer,
                  code: p.code.toUpperCase(),
                  hostName: p.sameNetwork ? `${p.hostName || 'Nearby Host'} (Wi-Fi)` : (p.hostName || 'Live Jam'),
                  members: p.memberCount ?? 1,
                  maxMembers: p.maxMembers ?? 5,
                  title: p.track?.title,
                  artist: p.track?.artist,
                  thumbnailUrl: p.track?.thumbnailUrl,
                  isPlaying: p.isPlaying ?? true,
                });
              }
            }
            if (results.length > 0) {
              set({ nearbyJams: [...results] });
            }
          }
        }
      } catch {
        // Render discover offline or unreachable
      }

      // 1. High-priority local targets
      const immediate = [
        localStorage.getItem('raaga:lastLocalJamHost'),
        'http://localhost:8890',
        'http://127.0.0.1:8890',
        'http://192.168.43.1:8890',
      ].filter(Boolean) as string[];
      await Promise.allSettled(immediate.map(checkHost));

      // 2. Discover local Wi-Fi subnet
      const subnets = new Set<string>();
      if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        const match = host.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
        if (match && match[1]) subnets.add(match[1]);
      }
      if (subnets.size === 0) {
        subnets.add('192.168.29'); // Jio / Airtel Fiber
        subnets.add('192.168.1');  // ACT / BSNL / Standard
        subnets.add('192.168.0');  // TP-Link
        subnets.add('192.168.43'); // Android Mobile Hotspot
      }

      for (const subnet of subnets) {
        // Probe router/gateway and addresses in fast concurrent chunks
        const ips = [1, ...Array.from({ length: 70 }, (_, i) => i + 2)];
        const chunkSize = 25;
        for (let i = 0; i < ips.length; i += chunkSize) {
          const chunk = ips.slice(i, i + chunkSize);
          await Promise.allSettled(chunk.map((num) => checkHost(`http://${subnet}.${num}:8890`)));
          if (results.length > 0) break;
        }
        if (results.length > 0) break;
      }

      set({ nearbyJams: results, lastScannedAt: Date.now() });
      return results;
    } finally {
      set({ isScanning: false });
    }
  },
}));

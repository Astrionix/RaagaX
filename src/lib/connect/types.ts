/**
 * RaagaX Connect — Core Protocols, Interfaces & Data Schemas
 *
 * Implements Layer Separation:
 * - Discovery != Authorization
 * - Transport != Control Plane != Playback State
 * - Audio Acquisition != Cloud Relay
 */

export type TransportKind = 'LOCAL_LAN' | 'P2P' | 'TURN_RELAY' | 'CLOUD_CONTROL';

export interface TransportScore {
  transport: TransportKind;
  latencyMs: number | null;   // null = unmeasured
  reliability: number;        // 0..1, rolling success rate
  costWeight: number;         // static: LAN=0, P2P=0, TURN=5, CLOUD=10
  available: boolean;
}

export const TRANSPORT_COST_WEIGHTS: Record<TransportKind, number> = {
  LOCAL_LAN: 0,
  P2P: 0,
  TURN_RELAY: 5,
  CLOUD_CONTROL: 10,
};

/**
 * Scoring Formula from Architecture Spec §2:
 * LAN always wins when available (costWeight=0, ultra-low latency)
 * Fluctuating or failing links get penalized.
 */
export function scoreTransport(t: TransportScore): number {
  if (!t.available) return -Infinity;
  const latencyPenalty = (t.latencyMs ?? 500) * 1.0;
  const reliabilityBonus = t.reliability * 200;
  const costPenalty = t.costWeight * 50;
  return reliabilityBonus - latencyPenalty - costPenalty;
}

export interface DiscoveredPeer {
  deviceId: string;
  deviceName?: string;
  pubKeyFingerprint: string;
  address?: string;
  port?: number;
  protoVersion: number;
  capabilities: ('player' | 'controller')[];
  transport: 'mdns' | 'udp_beacon' | 'cloud_presence';
  lastSeen: number;
  subnet?: string;
  accountId?: string | null;
  audioReady?: boolean;
  playerReady?: boolean;
}

export interface AuthorizedPeer {
  peer: DiscoveredPeer;
  role: 'controller' | 'player';
  sessionKey?: string;
  capabilityToken?: string;
  expiresAt: number;
}

export type ControlMessageType =
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'NEXT'
  | 'PREV'
  | 'VOLUME'
  | 'QUEUE_UPDATE'
  | 'REPEAT'
  | 'SHUFFLE'
  | 'SWITCH_PLAYBACK'
  | 'STATE_SYNC'
  | 'PING'
  | 'PONG'
  | 'DISCONNECT';

export interface ControlMessage {
  commandId: string;     // UUID, for idempotency
  sessionId: string;
  sequenceNumber: number;
  timestamp: number;
  type: ControlMessageType;
  payload: unknown;
  senderDeviceId: string;
}

export interface PlaybackState {
  sessionId: string;
  revision: number;      // Monotonic — reject/merge on stale revision
  trackId: string;
  position: number;      // Seconds
  duration: number;      // Seconds
  isPlaying: boolean;
  volume: number;        // 0..1
  queue: string[];       // Track IDs
  queueIndex?: number;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
  activePlayerDeviceId: string;
  updatedAt: number;
  currentSongData?: any; // Cached metadata snapshot for instant rendering
  queueSongs?: any[];    // Cached full queue metadata for complete queue sync
}

export interface SignalMessage {
  sessionId: string;
  fromDeviceId: string;
  toDeviceId: string;
  type: 'offer' | 'answer' | 'ice_candidate' | 'bye';
  payload: string;       // Opaque SDP/ICE, cloud does not parse semantics
  seq: number;
}

export interface SignalingChannel {
  sendSignal(msg: SignalMessage): Promise<void>;
  onSignal(cb: (msg: SignalMessage) => void): () => void;
}

export interface TransportHealth {
  latencyMs: number;
  ok: boolean;
}

export interface Transport {
  readonly kind: TransportKind;
  connect(peer: AuthorizedPeer): Promise<void>;
  send(msg: ControlMessage): Promise<void>;
  onMessage(cb: (msg: ControlMessage) => void): void;
  healthCheck(): Promise<TransportHealth>;
  close(): Promise<void>;
  isConnected(): boolean;
}

export interface ConnectMetrics {
  lanSessionCount: number;
  p2pSessionCount: number;
  turnSessionCount: number;
  cloudRelaySessionCount: number;
  lanBytes: number;
  p2pBytes: number;
  turnBytes: number;
  cloudEgressBytes: number;
  transportUpgrades: number;
  transportDowngrades: number;
  activeTransport: TransportKind | null;
  latencyMs: number | null;
}

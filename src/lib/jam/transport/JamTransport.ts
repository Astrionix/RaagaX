import { JamCommand, JamCommandResponse, JamEvent } from '@/types/jam';

export type JamTransportType = 'LOCAL_LAN' | 'CLOUD_REALTIME';

export type TransportState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DEGRADED'
  | 'FAILED';

export interface TransportHealth {
  transport: JamTransportType;
  state: TransportState;
  rttMs: number;
  rttMedianMs: number;
  jitterMs: number;
  packetLoss: number; // 0 to 100%
  lastHeartbeatAt: number;
  lastMessageAt: number;
  failureCount: number;
  reconnectCount: number;
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'OFFLINE';
}

export interface JamAuthCredentials {
  userId: string;
  userName: string;
  userAvatar?: string;
  authToken?: string;
  joinCode?: string;
  pin?: string;
}

export interface DeviceCapabilities {
  deviceId: string;
  deviceName: string;
  platform: 'WINDOWS' | 'ANDROID' | 'MACOS' | 'IOS' | 'LINUX' | 'WEB';
  audioEngine: 'HTML5_AUDIO' | 'RAAGAX_NATIVE_EXOPLAYER' | 'AVPLAYER';
  supportedCodecs: string[];
  backgroundPlayback: boolean;
  lanSupported: boolean;
  cloudSupported: boolean;
  protocolVersion: string;
}

export type JamEventListener = (event: JamEvent) => void;

/**
 * Standard Jam Transport Interface
 * All transports (Same Wi-Fi / Local LAN, Cloud Realtime) implement this common contract.
 * Transports NEVER maintain independent playback clocks or state.
 */
export interface JamTransport {
  readonly type: JamTransportType;
  readonly isConnected: boolean;

  /**
   * Establishes connection to the transport layer
   */
  connect(jamId: string, auth: JamAuthCredentials, endpoint?: string): Promise<boolean>;

  /**
   * Gracefully tears down connection
   */
  disconnect(): Promise<void>;

  /**
   * Dispatches an authoritative Jam command
   */
  sendCommand(command: JamCommand): Promise<JamCommandResponse>;

  /**
   * Subscribes to authoritative Jam events
   */
  subscribe(listener: JamEventListener): () => void;

  /**
   * Returns current transport health metrics
   */
  getHealth(): TransportHealth;

  /**
   * Evaluates if this transport is considered healthy for routing
   */
  isHealthy(): boolean;
}

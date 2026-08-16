import { DeviceCapabilities } from './types';

export type DeviceReachabilityState =
  | 'ACCOUNT_REGISTERED'
  | 'ONLINE'
  | 'OFFLINE'
  | 'LAN_REACHABLE'
  | 'CLOUD_REACHABLE'
  | 'APP_ACTIVE'
  | 'PLAYBACK_READY'
  | 'CURRENTLY_PLAYING'
  | 'AUDIO_OUTPUT_CONNECTED'
  | 'CONNECTING'
  | 'UNAVAILABLE'
  | 'STALE'
  | 'UNKNOWN';

export type DiscoverySource = 'LAN' | 'CLOUD' | 'TRUSTED' | 'AUDIO_OUTPUT' | 'CACHE';

export interface VerifiedDevice {
  deviceId: string;
  installationId: string;
  userId?: string;
  name: string;
  type: 'mobile' | 'desktop' | 'tv' | 'tablet' | 'audio_output';
  platform: 'Android' | 'Windows' | 'macOS' | 'iOS' | 'Web' | 'Linux' | 'Bluetooth' | 'AirPlay';
  appVersion: string;
  protocolVersion: number;
  capabilities: DeviceCapabilities;
  reachabilityState: DeviceReachabilityState;
  discoverySources: Set<DiscoverySource>;
  ipAddress?: string;
  port?: number;
  isTrusted: boolean;
  isNearby: boolean;
  isAudioOutput: boolean;
  activePlaybackSong?: string;
  activePlaybackPositionMs?: number;
  lastSeenTimestamp: number;
  verifiedAtTimestamp?: number;
  latencyMs?: number;
  rankingScore: number;
}

export type DeviceDiscoveryEventType =
  | 'DISCOVERED'
  | 'VERIFIED'
  | 'STATE_CHANGED'
  | 'CAPABILITY_UPDATED'
  | 'LOST'
  | 'OFFLINE';

export interface DeviceDiscoveryEvent {
  deviceId: string;
  source: DiscoverySource;
  type: DeviceDiscoveryEventType;
  device?: VerifiedDevice;
  timestamp: number;
}

'use client';

export type DeviceClassificationV3 =
  | 'OWN_DEVICE'
  | 'KNOWN_PAIRED_DEVICE'
  | 'NEARBY_UNPAIRED_DEVICE'
  | 'UNKNOWN_DEVICE'
  | 'OFFLINE';

export type RoutingDecisionV3 =
  | 'LAN'
  | 'CLOUD'
  | 'PAIR_FIRST'
  | 'UNAVAILABLE';

export interface UnifiedDeviceV3 {
  deviceId: string;
  accountId?: string;
  name: string;
  platform: 'android' | 'windows' | 'macos' | 'ios' | 'linux' | 'web';
  appVersion: string;
  protocolVersion: number;
  capabilities: string[];
  discoverySources: ('lan' | 'cloud')[];
  sameLocalNetwork: boolean;
  relationship: DeviceClassificationV3;
  selectedTransport: RoutingDecisionV3;
  ipAddress?: string;
  lastSeenTimestamp: number;
  isTrusted: boolean;
}

export interface FriendPairingSessionV3 {
  pairingId: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  sourceAccountId?: string;
  targetDeviceId: string;
  verificationCode: string; // e.g. "482 917"
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  permittedCapabilities: ('PLAYBACK_CONTROL' | 'QUEUE_CONTROL' | 'PLAYBACK_TRANSFER')[];
  createdAt: number;
  expiresAt: number;
}

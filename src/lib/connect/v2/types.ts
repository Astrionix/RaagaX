'use client';

import { DeviceCapabilities } from '../types';

export type DeviceDiscoveryStateV2 =
  | 'DISCOVERING'
  | 'AVAILABLE'
  | 'PAIRING'
  | 'PAIR_REQUEST_SENT'
  | 'PAIR_REQUEST_RECEIVED'
  | 'WAITING_FOR_APPROVAL'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'TRANSFERRING'
  | 'DISCONNECTING'
  | 'OFFLINE'
  | 'EXPIRED';

export type DeviceDiscoveryPrivacyMode =
  | 'VISIBLE'
  | 'VISIBLE_WHEN_APP_OPEN'
  | 'INVISIBLE';

export type DeviceOwnershipTier = 'SAME_ACCOUNT' | 'NEARBY_LAN';

export interface DeviceIdentityV2 {
  deviceId: string; // e.g. "rx_<stable-random-id>"
  userId?: string;  // Internal RaagaX Account ID (never raw email)
  name: string;
  platform: 'android' | 'windows' | 'macos' | 'ios' | 'linux' | 'web';
  appVersion: string;
  protocolVersion: number;
  capabilities: string[];
  discoveryEnabled: boolean;
  pairingStatus: 'UNPAIRED' | 'PAIRED' | 'BLOCKED';
  lastSeenTimestamp: number;
}

export interface DiscoveredDeviceV2 {
  deviceId: string;
  userId?: string;
  ownershipTier: DeviceOwnershipTier;
  name: string;
  platform: 'android' | 'windows' | 'macos' | 'ios' | 'linux' | 'web';
  appVersion: string;
  protocolVersion: number;
  capabilities: string[];
  state: DeviceDiscoveryStateV2;
  lastSeenTimestamp: number;
  ipAddress?: string;
  isTrusted: boolean;
}

export interface PairingRequestV2 {
  requestId: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  sourcePlatform: string;
  targetDeviceId: string;
  nonce: string;
  timestamp: number;
}

export interface PairingResponseV2 {
  requestId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  accepted: boolean;
  sessionToken?: string;
  capabilities: string[];
  timestamp: number;
}

export interface KnownDeviceV2 {
  deviceId: string;
  name: string;
  platform: string;
  pairedAt: number;
  lastConnectedAt: number;
  isTrusted: boolean;
}

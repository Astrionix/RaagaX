/**
 * Add-on protocol types for Raaga Web.
 * Matching the specification from Android's AddonSource.kt and Desktop's DesktopAddon.kt.
 */

export interface AddonManifest {
  id: string;
  name: string;
  version: string;
  resources: string[]; // e.g. ["search", "stream"]
  allowDownloads?: boolean;
  settings?: Array<{
    key: string;
    label: string;
    type: string;
    default?: unknown;
  }>;
}

export interface AddonTrack {
  id: string;
  title: string;
  artist?: string;
  artists?: string[] | string;
  album?: string;
  durationSec?: number;
  duration?: number;
  quality?: 'LOSSLESS' | 'HI_RES' | 'DOLBY' | 'HIGH' | 'LOW' | string;
  streamUrl?: string;
  streamURL?: string;
}

export interface AddonSearchResponse {
  tracks?: AddonTrack[];
  results?: AddonTrack[];
}

export interface AddonStream {
  url: string;
  format?: {
    codec?: string;
    bitrateKbps?: number;
    sampleRateHz?: number;
    bitDepth?: number;
    quality?: string;
  };
}

export type AddonTier = 'LOSSLESS' | 'HIGH' | 'LOW';

export interface AddonSourceConfig {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  tier: AddonTier;
  addedAt: number;
  manifest?: AddonManifest | null;
}

export interface AddonUpgradeState {
  active: boolean;
  addonId: string;
  addonName: string;
  quality: string;
  streamUrl: string;
  format?: AddonStream['format'];
}

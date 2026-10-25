import type { DetectedExtension } from '@raaga/shared/bridge';
import { queryClient } from '@/lib/queryClient';
import { extensionQueryKey } from '@/extension/useExtension';
import type { AddonManifest, AddonSearchResponse, AddonStream, AddonTier, AddonTrack } from './types';

/**
 * Normalizes an Addon URL by trimming whitespace, trailing slashes,
 * and stripping '/manifest.json' or '/addon.json' if pasted directly.
 */
export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Strip manifest.json or addon.json
  url = url.replace(/\/(manifest|addon)\.json\/?$/i, '');
  // Strip trailing slashes
  url = url.replace(/\/+$/, '');
  return url;
}

/**
 * Masks token or credentials in an Addon URL for safe UI display and logs.
 */
export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.length > 1) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length > 1) {
        return `${parsed.origin}/${parts[0]}/••••`;
      }
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Makes an HTTP GET request to an Add-on endpoint.
 * Tries direct browser fetch first (works when CORS is enabled on the addon).
 * If direct fetch encounters CORS or network errors, delegates to the Raaga Extension bridge.
 */
async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Direct fetch attempt
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`Addon responded with HTTP ${res.status} (${res.statusText})`);
    }
    return (await res.json()) as T;
  } catch (directErr) {
    clearTimeout(timer);

    // 2. Fallback via Companion Extension bridge if installed
    const ext = queryClient.getQueryData<DetectedExtension | null>(extensionQueryKey);
    if (ext?.bridge) {
      try {
        const response = await ext.bridge.call('addon.fetch', {
          url,
          method: 'GET',
          headers: { Accept: 'application/json' },
        }, { timeoutMs });

        if (response.status >= 200 && response.status < 300) {
          return JSON.parse(response.body) as T;
        }
        throw new Error(`Addon bridge responded with HTTP ${response.status}`);
      } catch (bridgeErr) {
        throw new Error(
          `Failed to connect to addon: ${directErr instanceof Error ? directErr.message : String(directErr)} (Bridge: ${bridgeErr instanceof Error ? bridgeErr.message : String(bridgeErr)})`
        );
      }
    }

    throw directErr;
  }
}

export class AddonClient {
  readonly baseUrl: string;

  constructor(rawBaseUrl: string) {
    this.baseUrl = normalizeBaseUrl(rawBaseUrl);
  }

  /**
   * Fetches and validates the Add-on manifest.
   */
  async manifest(): Promise<AddonManifest> {
    const manifestUrl = `${this.baseUrl}/manifest.json`;
    try {
      const data = await fetchJson<AddonManifest>(manifestUrl);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid manifest JSON');
      }
      return {
        id: data.id || 'addon',
        name: data.name || data.id || 'Custom Add-on',
        version: data.version || '1.0',
        resources: Array.isArray(data.resources) ? data.resources : ['search', 'stream'],
        allowDownloads: data.allowDownloads ?? true,
        settings: Array.isArray(data.settings) ? data.settings : [],
      };
    } catch {
      // If /manifest.json fails, probe /search to verify if it's an unmanifested endpoint
      const searchProbe = await this.search('probe_check', 'LOSSLESS').catch(() => null);
      if (searchProbe !== null) {
        return {
          id: 'custom-addon',
          name: new URL(this.baseUrl).hostname,
          version: '1.0',
          resources: ['search', 'stream'],
          allowDownloads: true,
        };
      }
      throw new Error(`Could not reach addon at ${maskUrl(this.baseUrl)}`);
    }
  }

  /**
   * Searches the Addon catalogue for tracks.
   */
  async search(query: string, tier: AddonTier = 'LOSSLESS'): Promise<AddonTrack[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('quality', tier.toLowerCase());
    url.searchParams.set('tier', tier.toLowerCase());

    const data = await fetchJson<AddonSearchResponse | AddonTrack[]>(url.toString());
    const rawList = Array.isArray(data) ? data : data.tracks || data.results || [];

    return rawList.map((t) => {
      const durationSec = t.durationSec ?? (t.duration ? Math.round(t.duration > 1000 ? t.duration / 1000 : t.duration) : undefined);
      return {
        id: String(t.id),
        title: t.title || '',
        artist: t.artist || (Array.isArray(t.artists) ? t.artists.join(', ') : t.artists) || '',
        album: t.album || '',
        durationSec,
        quality: t.quality || 'LOSSLESS',
        streamUrl: t.streamUrl || t.streamURL,
      };
    });
  }

  /**
   * Resolves a streamable audio URL for a given track id.
   */
  async stream(trackId: string, tier: AddonTier = 'LOSSLESS'): Promise<AddonStream | null> {
    const encodedId = encodeURIComponent(trackId);
    const url = new URL(`${this.baseUrl}/stream/${encodedId}`);
    url.searchParams.set('quality', tier.toLowerCase());
    url.searchParams.set('tier', tier.toLowerCase());

    try {
      const res = await fetchJson<AddonStream | { url?: string; streamUrl?: string; format?: AddonStream['format'] }>(url.toString());
      const streamUrl = res.url || (res as { streamUrl?: string }).streamUrl;
      if (!streamUrl) return null;

      // Make relative URLs absolute against baseUrl
      const absoluteUrl = new URL(streamUrl, this.baseUrl).toString();
      return {
        url: absoluteUrl,
        format: res.format || {
          quality: tier,
          codec: absoluteUrl.endsWith('.flac') ? 'flac' : 'mp3',
          bitrateKbps: tier === 'LOSSLESS' ? 1411 : 320,
        },
      };
    } catch {
      return null;
    }
  }
}

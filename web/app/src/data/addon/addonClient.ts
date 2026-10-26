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
    return `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Resolves a stream URL to a playable URL in the browser,
 * avoiding Mixed Content errors (HTTP audio on HTTPS page) and media CORS blocks.
 */
export function toPlayableStreamUrl(streamUrl: string): string {
  if (!streamUrl) return streamUrl;
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  // If the web app is served over HTTPS and the stream URL is insecure HTTP,
  // browsers block it as Mixed Active Content. We proxy it through our audio stream proxy.
  if (isHttps && streamUrl.startsWith('http://')) {
    return `/api/addon-stream-proxy?url=${encodeURIComponent(streamUrl)}`;
  }
  return streamUrl;
}

/**
 * Makes an HTTP GET request to an Add-on endpoint with multi-tier fallback:
 * 1. Direct browser fetch (fastest, works when CORS is enabled on the addon).
 * 2. Raaga Companion Extension bridge (if installed, bypasses browser CORS & Mixed Content).
 * 3. Local / App Server Proxy (/api/addon-proxy?url=...).
 * 4. Public CORS Proxy fallback (for static web deployments without extension).
 */
async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // 1. Direct fetch attempt
  try {
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

    // If it's an explicit HTTP status error from the server (not a network/CORS error), don't proxy
    if (directErr instanceof Error && directErr.message.startsWith('Addon responded with HTTP')) {
      throw directErr;
    }

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
      } catch {
        // Fall through to next fallback
      }
    }

    // 3. Fallback via Local / Vite App Server Proxy (/api/addon-proxy)
    try {
      const proxyUrl = `/api/addon-proxy?url=${encodeURIComponent(url)}`;
      const proxyRes = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (proxyRes.ok) {
        return (await proxyRes.json()) as T;
      }
    } catch {
      // Local proxy not available or failed
    }

    // 4. Fallback via Public CORS Proxy (e.g. for static web hosting)
    try {
      const publicProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const publicRes = await fetch(publicProxyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (publicRes.ok) {
        return (await publicRes.json()) as T;
      }
    } catch {
      // Public fallback failed
    }

    throw new Error(
      `Could not connect to Add-on at ${maskUrl(url)}. (CORS / Network Error). Ensure dev server is running or install Raaga Extension.`
    );
  }
}

export class AddonClient {
  readonly baseUrl: string;
  /** Cached manifest, fetched once per instance — mirrors Android's SharedCalls pattern. */
  private _manifest: AddonManifest | null = null;

  // Quality option words — mirrors Android's LOSSLESS_WORDS / HIGH_WORDS / LOW_WORDS
  private static readonly LOSSLESS_WORDS = ['lossless', 'flac', 'hifi', 'hi-res', 'hires', 'max', 'best'];
  private static readonly HIGH_WORDS = ['high', '320', 'normal', 'standard'];
  private static readonly LOW_WORDS = ['low', '96', '128', 'min'];

  constructor(rawBaseUrl: string) {
    this.baseUrl = normalizeBaseUrl(rawBaseUrl);
  }

  /**
   * Fetches and validates the Add-on manifest.
   */
  async manifest(): Promise<AddonManifest> {
    if (this._manifest) return this._manifest;
    const manifestUrl = `${this.baseUrl}/manifest.json`;
    try {
      const data = await fetchJson<AddonManifest>(manifestUrl);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid manifest JSON');
      }
      this._manifest = {
        id: data.id || 'addon',
        name: data.name || data.id || 'Custom Add-on',
        version: data.version || '1.0',
        resources: Array.isArray(data.resources) ? data.resources : ['search', 'stream'],
        allowDownloads: data.allowDownloads ?? true,
        settings: Array.isArray(data.settings) ? data.settings : [],
      };
      return this._manifest;
    } catch {
      // If /manifest.json fails, probe /search to verify if it's an unmanifested endpoint
      const searchProbe = await this.search('probe_check', 'LOSSLESS').catch(() => null);
      if (searchProbe !== null) {
        this._manifest = {
          id: 'custom-addon',
          name: new URL(this.baseUrl).hostname,
          version: '1.0',
          resources: ['search', 'stream'],
          allowDownloads: true,
        };
        return this._manifest;
      }
      throw new Error(`Could not reach addon at ${maskUrl(this.baseUrl)}`);
    }
  }

  /**
   * Picks the addon's own quality option string that best answers a request for [tier].
   * Mirrors Android's AddonClient.matchTier() — matches on words rather than exact strings,
   * so "hires", "hi-res", "FLAC", "lossless" all map from LOSSLESS tier correctly.
   */
  private static matchTier(tier: AddonTier, options: string[]): string | null {
    if (!options.length) return null;
    const exact = options.find((o) => o.toLowerCase() === tier.toLowerCase());
    if (exact) return exact;
    const words =
      tier === 'LOSSLESS' ? AddonClient.LOSSLESS_WORDS : tier === 'LOW' ? AddonClient.LOW_WORDS : AddonClient.HIGH_WORDS;
    return options.find((o) => words.some((w) => o.toLowerCase().includes(w))) ?? options[0] ?? null;
  }

  /**
   * Builds query params from manifest declared settings defaults, then overlays the
   * properly-matched quality value. Mirrors Android's AddonClient.settingsFor().
   *
   * This is the fix for "Desktop gets lossless, web doesn't":
   *   eljohnzc manifest declares options ["hires","lossless","high","low"]; LOSSLESS tier
   *   must map to "hires" (the best option), not send "lossless" literally.
   */
  private async settingsFor(tier: AddonTier): Promise<Record<string, string>> {
    const mfst = await this.manifest().catch(() => null);
    const declared = mfst?.settings ?? [];
    const params: Record<string, string> = {};

    // Apply all declared setting defaults first
    for (const setting of declared) {
      if (setting.key && setting.default !== undefined && setting.default !== null) {
        params[setting.key] = String(setting.default);
      }
    }

    // Override quality with the best-matched option from the manifest's options list
    const qualitySetting = declared.find((s) => s.key === 'quality');
    const options = qualitySetting
      ? (Array.isArray((qualitySetting as any).options)
          ? ((qualitySetting as any).options as Array<{ value?: string; label?: string } | string>).map((o) =>
              typeof o === 'string' ? o : o.value ?? o.label ?? ''
            )
          : []
        ).filter(Boolean)
      : [];

    params['quality'] = AddonClient.matchTier(tier, options) ?? tier.toLowerCase();
    params['tier'] = tier.toLowerCase();
    return params;
  }

  /**
   * Searches the Addon catalogue for tracks.
   * Uses settingsFor() so the manifest's own quality option labels are used
   * (e.g. "hires" instead of "lossless" for LOSSLESS tier on eljohnzc).
   */
  async search(query: string, tier: AddonTier = 'LOSSLESS'): Promise<AddonTrack[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const params = await this.settingsFor(tier);
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('q', trimmed);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

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
        quality: t.quality || (t as { audioQuality?: string }).audioQuality || 'LOSSLESS',
        streamUrl: t.streamUrl || t.streamURL,
      };
    });
  }

  /**
   * Resolves a streamable audio URL for a given track id.
   * Uses settingsFor() so the matched quality label (e.g. "hires") is sent instead
   * of the raw tier name — mirrors Android's AddonClient.stream().
   */
  async stream(trackId: string, tier: AddonTier = 'LOSSLESS'): Promise<AddonStream | null> {
    const encodedId = encodeURIComponent(trackId);
    const params = await this.settingsFor(tier);
    const url = new URL(`${this.baseUrl}/stream/${encodedId}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    try {
      const res = await fetchJson<AddonStream | { url?: string; streamUrl?: string; format?: AddonStream['format'] }>(url.toString());
      const streamUrl = res.url || (res as { streamUrl?: string }).streamUrl;
      if (!streamUrl) return null;

      // Make relative URLs absolute against baseUrl and ensure it is playable (Mixed Content protection)
      const absoluteUrl = new URL(streamUrl, this.baseUrl).toString();
      const playableUrl = toPlayableStreamUrl(absoluteUrl);
      return {
        url: playableUrl,
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

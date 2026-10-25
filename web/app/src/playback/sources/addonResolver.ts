/**
 * Addon & Multi-source Audio Stream Resolver (web counterpart of DesktopSourceRegistry.kt,
 * DesktopAddon.kt, and DesktopJioSaavn.kt).
 *
 * Resolves bit-exact lossless FLAC (up to 24-bit 192kHz) and high-fidelity 320kbps AAC streams
 * from enabled Addons (Qobuz, Chan, etc.) and JioSaavn CDN, racing and upgrading over YouTube.
 */

import { useAddons, type AddonSource } from '@/data/addons/addonManager';
import {
  best,
  queries,
  ranked,
  type MatchCandidate,
  type MatchTarget,
} from '@/data/match/trackMatcher';
import type { Track } from '@/data/music/types';
import { trackLog } from '@/playback/trackLog';
import type { AudioQualitySetting } from '@/state/desktopSettings';
import { decryptDesEcbBase64 } from './des';

export interface ResolvedStream {
  url: string;
  codec: string;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
  bitDepth: number | null;
  sourceName: string;
  isLossless: boolean;
  isDolbyAtmos?: boolean;
  streamInfo: string;
  trackId: string;
  durationSec?: number | null;
}

export interface AddonApiTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number | string;
  artworkURL?: string;
  albumArtworkURL?: string;
  format?: string;
  audioQuality?: string;
  audioMode?: string;
  audioModes?: string[];
  atmos?: boolean;
  streamURL?: string;
}

export interface AddonApiStream {
  url?: string;
  format?: string;
  quality?: string;
  streamQuality?: string;
  audioQuality?: string;
  codec?: string;
  fileCodec?: string;
  container?: string;
  containerFormat?: string;
  manifest?: string;
  mediaType?: string;
  mimeType?: string;
  encrypted?: boolean | string;
  sampleRate?: number | string;
  bitDepth?: number | string;
  bitrate?: number | string;
  audioMode?: string;
  audioModes?: string[];
  error?: string;
}

const SAAVN_BASE = 'https://www.jiosaavn.com/api.php';
const SAAVN_KEY = '38346591';
const AUDIO_CODECS = new Set([
  'flac', 'alac', 'wav', 'aiff', 'mp3', 'aac', 'he-aac', 'm4a', 'mp4',
  'ogg', 'opus', 'vorbis', 'webm', 'eac3-joc', 'ec3-joc',
]);

// In-memory stream resolution cache
const streamCache = new Map<string, { stream: ResolvedStream; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCached(key: string): ResolvedStream | null {
  const item = streamCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    streamCache.delete(key);
    return null;
  }
  return item.stream;
}

function setCached(key: string, stream: ResolvedStream) {
  streamCache.set(key, { stream, expiresAt: Date.now() + CACHE_TTL_MS });
}

function tierFor(quality?: AudioQualitySetting): string {
  switch (quality) {
    case 'low':
      return 'low';
    case 'medium':
    case 'standard':
    case 'high':
      return 'high';
    case 'lossless':
    default:
      return 'lossless';
  }
}

// ── JioSaavn Provider ───────────────────────────────────────────────────────

interface SaavnRawSong {
  id: string;
  title: string;
  image: string;
  more_info?: {
    album?: string;
    artistMap?: {
      primary_artists?: { name: string }[];
      artists?: { name: string }[];
    };
    duration?: string | number;
    encrypted_media_url?: string;
    '320kbps'?: boolean | string;
  };
}

async function fetchSaavn(params: URLSearchParams): Promise<string | null> {
  const queryStr = params.toString();
  const endpoints =
    typeof window !== 'undefined'
      ? [
          `/api/jiosaavn/api.php?${queryStr}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.jiosaavn.com/api.php?${queryStr}`)}`,
          `https://www.jiosaavn.com/api.php?${queryStr}`,
        ]
      : [`https://www.jiosaavn.com/api.php?${queryStr}`];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36',
          Cookie: 'explicit_content=1',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // try next endpoint
    }
  }
  return null;
}

export async function searchJioSaavn(query: string, limit = 15): Promise<Array<MatchCandidate & { raw: SaavnRawSong }>> {
  try {
    const params = new URLSearchParams({
      __call: 'search.getResults',
      _format: 'json',
      _marker: '0',
      api_version: '4',
      ctx: 'android',
      q: query.trim(),
      p: '1',
      n: String(limit),
    });

    const text = await fetchSaavn(params);
    if (!text) return [];

    const data = JSON.parse(text) as { results?: SaavnRawSong[] };
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((item) => {
      const primaryArtists = item.more_info?.artistMap?.primary_artists?.map((a) => a.name).join(', ')
        || item.more_info?.artistMap?.artists?.map((a) => a.name).join(', ')
        || 'Unknown Artist';

      const durationSec = item.more_info?.duration ? parseInt(String(item.more_info.duration), 10) : null;

      return {
        title: decodeHtmlEntities(item.title || ''),
        artist: decodeHtmlEntities(primaryArtists),
        album: decodeHtmlEntities(item.more_info?.album || ''),
        durationSec,
        raw: item,
      };
    });
  } catch (err) {
    trackLog.d(`JioSaavn search failed: ${String(err)}`);
    return [];
  }
}

export function rewriteJioSaavn320Url(url: string, supports320 = true): { url: string; bitrate: number } {
  const match = url.match(/_(48|96|160|320)\.(mp4|aac|mp3)$/i);
  if (!match) {
    return { url, bitrate: supports320 ? 320 : 160 };
  }
  const ext = match[2];
  if (supports320) {
    return {
      url: url.replace(match[0], `_320.${ext}`),
      bitrate: 320,
    };
  }
  return {
    url,
    bitrate: parseInt(match[1] || '160', 10),
  };
}

export async function resolveJioSaavnStream(target: MatchTarget): Promise<ResolvedStream | null> {
  const queryList = queries(target);
  for (const q of queryList) {
    const candidates = await searchJioSaavn(q, 10);
    if (!candidates.length) continue;

    const matched = best(candidates, target);
    if (!matched || !matched.raw.more_info?.encrypted_media_url) continue;

    const decrypted = decryptDesEcbBase64(matched.raw.more_info.encrypted_media_url, SAAVN_KEY);
    if (!decrypted || !decrypted.startsWith('http')) continue;

    const supports320 = matched.raw.more_info['320kbps'] !== false && matched.raw.more_info['320kbps'] !== 'false';
    const rewritten = rewriteJioSaavn320Url(decrypted, supports320);

    return {
      url: rewritten.url,
      codec: 'mp4',
      bitrateKbps: rewritten.bitrate,
      sampleRateHz: 44100,
      bitDepth: 16,
      sourceName: 'JioSaavn',
      isLossless: false,
      streamInfo: `AAC ${rewritten.bitrate}kbps via JioSaavn`,
      trackId: `jiosaavn:${matched.raw.id}`,
      durationSec: matched.durationSec,
    };
  }
  return null;
}

// ── Generic Addon Provider ─────────────────────────────────────────────────

export async function searchAddon(
  addon: AddonSource,
  query: string,
  tier: string,
): Promise<Array<MatchCandidate & { raw: AddonApiTrack }>> {
  try {
    const url = `${addon.baseUrl}/search?q=${encodeURIComponent(query.trim())}&quality=${encodeURIComponent(tier)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { tracks?: AddonApiTrack[] };
    if (!data.tracks || !Array.isArray(data.tracks)) return [];

    return data.tracks
      .filter((t) => t.id && t.title)
      .map((t) => {
        const dur = typeof t.duration === 'number' ? Math.round(t.duration) : t.duration ? parseInt(String(t.duration), 10) : null;
        return {
          title: t.title,
          artist: t.artist || '',
          album: t.album || null,
          durationSec: dur,
          raw: t,
        };
      });
  } catch (err) {
    trackLog.d(`${addon.name} search failed: ${String(err)}`);
    return [];
  }
}

export async function streamAddon(
  addon: AddonSource,
  track: AddonApiTrack,
  tier: string,
): Promise<ResolvedStream | null> {
  try {
    let answer: AddonApiStream | null = null;
    const streamUrl = `${addon.baseUrl}/stream/${encodeURIComponent(track.id)}?quality=${encodeURIComponent(tier)}`;
    try {
      const res = await fetch(streamUrl, { signal: AbortSignal.timeout(7000) });
      if (res.ok) {
        answer = (await res.json()) as AddonApiStream;
      }
    } catch {
      // Stream call failed; check if search row had direct streamURL
    }

    const playableUrl = answer?.url || track.streamURL;
    if (!playableUrl || !playableUrl.startsWith('http')) {
      return null;
    }

    const statedCodec = (answer?.codec || answer?.fileCodec || '').toLowerCase();
    const isDolbyAtmos = !!(
      answer?.audioMode?.toLowerCase().includes('atmos') ||
      track.atmos ||
      track.audioMode?.toLowerCase().includes('atmos') ||
      track.format?.toLowerCase().includes('atmos')
    );

    const isLossless =
      statedCodec === 'flac' ||
      statedCodec === 'alac' ||
      statedCodec === 'wav' ||
      (answer?.quality || '').toLowerCase().includes('lossless') ||
      (answer?.quality || '').toLowerCase().includes('hi-res') ||
      (track.audioQuality || '').toLowerCase().includes('lossless') ||
      (track.format || '').toLowerCase().includes('flac') ||
      tier === 'lossless';

    const codec = statedCodec && AUDIO_CODECS.has(statedCodec)
      ? statedCodec
      : isDolbyAtmos
        ? 'eac3-joc'
        : isLossless
          ? 'flac'
          : playableUrl.includes('.mp3')
            ? 'mp3'
            : 'mp4';

    const sampleRateRaw = answer?.sampleRate ? parseFloat(String(answer.sampleRate)) : null;
    const sampleRateHz = sampleRateRaw
      ? sampleRateRaw < 1000
        ? Math.round(sampleRateRaw * 1000)
        : Math.round(sampleRateRaw)
      : isLossless
        ? 96000
        : 44100;

    const bitDepthRaw = answer?.bitDepth ? parseInt(String(answer.bitDepth), 10) : null;
    const bitDepth = bitDepthRaw ?? (isLossless && sampleRateHz > 48000 ? 24 : isLossless ? 16 : 16);

    const bitrateRaw = answer?.bitrate ? Math.round(parseFloat(String(answer.bitrate))) : null;
    const bitrateKbps = bitrateRaw ?? (isLossless ? (bitDepth === 24 ? 921 : 705) : 320);

    const streamInfo = isLossless
      ? `FLAC ${bitDepth}-bit ${sampleRateHz}Hz ${bitrateKbps}kbps via ${addon.name}`
      : `${codec.toUpperCase()} ${bitrateKbps}kbps via ${addon.name}`;

    return {
      url: playableUrl,
      codec,
      bitrateKbps,
      sampleRateHz,
      bitDepth,
      sourceName: addon.name,
      isLossless,
      isDolbyAtmos,
      streamInfo,
      trackId: `${addon.id}:${track.id}`,
      durationSec: typeof track.duration === 'number' ? Math.round(track.duration) : null,
    };
  } catch (err) {
    trackLog.d(`${addon.name} stream fetch failed: ${String(err)}`);
    return null;
  }
}

// ── Multi-Source Racing & Resolution ────────────────────────────────────────

/**
 * Resolves the best available audio stream for a track from enabled addons and JioSaavn.
 * Returns null if quality ceiling does not request lossless/high or if no sources match.
 */
export async function resolveLiveAddonStream(
  track: Track,
  quality: AudioQualitySetting = 'lossless',
): Promise<ResolvedStream | null> {
  // If user explicitly selected low bandwidth saver, let YouTube handle it
  if (quality === 'low') {
    return null;
  }

  const cacheKey = `${track.videoId}:${quality}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const target: MatchTarget = {
    title: track.title,
    artist: track.artists.map((a) => a.name).join(', '),
    album: track.album?.name ?? null,
    durationSec: track.durationSec,
    isVideo: false,
  };

  const allConfigured = useAddons.getState().addons;
  const enabledAddons = allConfigured.filter(
    (a) => a.enabled && a.baseUrl?.trim().length > 0 && !a.id.includes('jiosaavn'),
  );
  const isJioEnabled =
    allConfigured.length === 0 ||
    allConfigured.some(
      (a) => (a.id === 'jiosaavn-stream-addon' || a.name.toLowerCase().includes('jiosaavn')) && a.enabled !== false,
    );
  const tier = tierFor(quality);

  trackLog.i(`Searching high quality sources for '${track.title}' (tier: ${tier})...`, track.videoId);

  // 1. Query enabled Addons in parallel
  const addonPromises = enabledAddons.map(async (addon) => {
    try {
      const qList = queries(target);
      for (const q of qList) {
        const candidates = await searchAddon(addon, q, tier);
        if (!candidates.length) continue;
        const matched = best(candidates, target);
        if (matched) {
          const stream = await streamAddon(addon, matched.raw, tier);
          if (stream) return stream;
        }
      }
    } catch (e) {
      trackLog.d(`Error resolving from ${addon.name}: ${String(e)}`);
    }
    return null;
  });

  // 2. Query JioSaavn native 320kbps engine in parallel
  const jioPromise = isJioEnabled ? resolveJioSaavnStream(target).catch(() => null) : Promise.resolve(null);

  // Race or await responses
  const allResults = await Promise.allSettled([...addonPromises, jioPromise]);
  const streams: ResolvedStream[] = [];

  for (const r of allResults) {
    if (r.status === 'fulfilled' && r.value) {
      streams.push(r.value);
    }
  }

  if (!streams.length) {
    trackLog.d(`No high quality stream found for '${track.title}', falling back to YouTube.`, track.videoId);
    return null;
  }

  // Priority: Lossless (FLAC) > 320kbps > other
  streams.sort((a, b) => {
    if (a.isLossless && !b.isLossless) return -1;
    if (!a.isLossless && b.isLossless) return 1;
    return (b.bitrateKbps || 0) - (a.bitrateKbps || 0);
  });

  const bestStream = streams[0]!;
  setCached(cacheKey, bestStream);
  trackLog.i(
    `substituted: '${track.title}' served by ${bestStream.sourceName} at ${bestStream.streamInfo}`,
    track.videoId,
  );

  return bestStream;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

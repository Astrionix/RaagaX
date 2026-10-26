import type { Track } from '@/data/music/types';
import { queries, ranked, type MatchCandidate, type MatchTarget } from '@/data/match/trackMatcher';
import { getAudio, usePlayer } from '@/state/player';
import { trackLog } from '@/playback/trackLog';
import { AddonClient, toPlayableStreamUrl } from './addonClient';
import { useAddonStore } from './addonStore';
import type { AddonStream } from './types';

export interface AddonUpgradeResult {
  streamUrl: string;
  addonId: string;
  addonName: string;
  quality: string;
  format?: AddonStream['format'];
}

/**
 * Searches all enabled Addons for a Lossless / High-quality recording matching [target].
 * Uses TrackMatcher to guarantee bit-exact title, artist, and duration agreement.
 */
export async function findAddonUpgrade(target: MatchTarget): Promise<AddonUpgradeResult | null> {
  const enabled = useAddonStore.getState().getEnabledAddons();
  if (!enabled.length) return null;

  const searchQueries = queries(target);
  if (!searchQueries.length) return null;

  for (const addon of enabled) {
    try {
      const client = new AddonClient(addon.baseUrl);

      // Try queries in order of precision
      for (const query of searchQueries.slice(0, 3)) {
        const results = await client.search(query, addon.tier);
        if (!results.length) continue;

        // Adapt AddonTracks to MatchCandidate
        const candidates: Array<MatchCandidate & { id: string; quality?: string; streamUrl?: string }> = results.map((r) => ({
          id: r.id,
          title: r.title,
          artist: r.artist || '',
          durationSec: r.durationSec ?? null,
          album: r.album || null,
          quality: r.quality,
          streamUrl: r.streamUrl,
        }));

        const rankedMatches = ranked(candidates, target);
        // Try top candidates in case a single stream provider is unavailable
        for (const matched of rankedMatches.slice(0, 5)) {
          // If candidate row already provides direct streamUrl, use it immediately
          if (matched.streamUrl) {
            const absoluteUrl = new URL(matched.streamUrl, addon.baseUrl).toString();
            return {
              streamUrl: toPlayableStreamUrl(absoluteUrl),
              addonId: addon.id,
              addonName: addon.name,
              quality: matched.quality || addon.tier,
            };
          }

          // Otherwise query /stream/{id}
          const stream = await client.stream(matched.id, addon.tier);
          if (stream?.url) {
            return {
              streamUrl: stream.url,
              addonId: addon.id,
              addonName: addon.name,
              quality: matched.quality || addon.tier,
              format: stream.format,
            };
          }
        }
      }
    } catch (err) {
      trackLog.w(`Addon [${addon.name}] search failed: ${String(err)}`);
    }
  }

  return null;
}

/** Token to avoid applying stale upgrades if the user skips tracks quickly. */
let activeUpgradeToken = 0;

/**
 * "The Second Look": Runs concurrently when a track plays.
 * If an Addon provides an upgraded Lossless / Hi-Res FLAC stream,
 * it replaces the audio source at the current playhead smoothly.
 */
export async function attemptAddonUpgrade(track: Track): Promise<void> {
  const token = ++activeUpgradeToken;
  useAddonStore.getState().clearUpgrade();

  const enabled = useAddonStore.getState().getEnabledAddons();
  if (!enabled.length) return;

  const artistName = track.artists?.map((a) => a.name).join(', ') || '';
  const audio = getAudio();
  const measuredDuration = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;

  const target: MatchTarget = {
    title: track.title,
    artist: artistName,
    durationSec: track.durationSec || measuredDuration,
    album: track.album?.name ?? null,
  };

  const upgrade = await findAddonUpgrade(target);
  if (token !== activeUpgradeToken || !upgrade) return;

  // Perform smooth hot-swap to the upgraded Add-on stream without disrupting Shaka
  try {
    const { upgradeActiveDeckToStream } = await import('@/state/player');
    const upgraded = await upgradeActiveDeckToStream(upgrade.streamUrl, track.videoId);
    if (!upgraded || token !== activeUpgradeToken) return;

    // Update store state and stats for nerds
    useAddonStore.getState().setUpgradeState({
      active: true,
      addonId: upgrade.addonId,
      addonName: upgrade.addonName,
      quality: upgrade.quality,
      streamUrl: upgrade.streamUrl,
      format: upgrade.format,
    });

    const isFlac =
      upgrade.streamUrl.toLowerCase().includes('.flac') ||
      upgrade.quality === 'LOSSLESS' ||
      upgrade.quality === 'HI_RES' ||
      upgrade.format?.codec?.toLowerCase() === 'flac';

    const bitrate = upgrade.format?.bitrateKbps || (isFlac ? 1411 : 320);
    const sampleRate = upgrade.format?.sampleRateHz || 44100;
    const bitDepth = upgrade.format?.bitDepth || (isFlac ? 16 : undefined);
    const streamInfo = `${isFlac ? 'FLAC' : 'AUDIO'} · ${bitrate} kbps · ${upgrade.quality}`;

    const currentNp = usePlayer.getState().nowPlaying;
    if (currentNp && currentNp.videoId === track.videoId) {
      usePlayer.setState({
        nowPlaying: {
          ...currentNp,
          streamInfo,
          stream: {
            codec: isFlac ? 'FLAC' : (upgrade.format?.codec?.toUpperCase() || 'AAC/MP3'),
            itag: null,
            bitrateKbps: bitrate,
            sampleRateHz: sampleRate,
            channels: 2,
            client: `Addon: ${upgrade.addonName}`,
            mode: 'direct',
            bitDepth,
          },
        },
      });
    }

    trackLog.d(`Successfully upgraded track to ${upgrade.quality} via Addon: ${upgrade.addonName}`, track.videoId);
  } catch (error) {
    trackLog.w(`Failed to hot-swap to addon stream: ${String(error)}`, track.videoId);
  }
}

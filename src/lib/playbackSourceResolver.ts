import { Song } from '@/types/music';
import { PlaybackSource } from '@/lib/offline/types';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { getCachedAudioUrl } from '@/lib/downloadHelper';
import { NetworkManager } from '@/lib/offline/NetworkManager';
import { QualityManager } from '@/lib/playback/QualityManager';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlayableUrlCache } from '@/lib/playback/PlayableUrlCache';

export class PlaybackSourceResolver {
  private static instance: PlaybackSourceResolver;

  public static getInstance(): PlaybackSourceResolver {
    if (!PlaybackSourceResolver.instance) {
      PlaybackSourceResolver.instance = new PlaybackSourceResolver();
    }
    return PlaybackSourceResolver.instance;
  }

  public async resolvePlayableSource(song: Song, options?: { bypassCache?: boolean }): Promise<PlaybackSource | null> {
    if (!song || !song.id) {
      return null;
    }

    const bypassCache = Boolean(options?.bypassCache);
    const networkMode = NetworkManager.getInstance().getMode();
    const isOfflineForced = networkMode === 'offline_forced';
    const isOffline = networkMode === 'offline' || isOfflineForced || (typeof navigator !== 'undefined' && navigator.onLine === false);

    // ── OFFLINE MODE: Resolve ONLY from RaagaX Local Downloads ─────────────
    if (isOffline) {
      // 1. Check Native Android Physical Music/RaagaX/Songs Storage
      try {
        const { RaagaXNativeDownload } = await import('@/lib/playback/native/RaagaXNativeDownload');
        if (RaagaXNativeDownload.isNative()) {
          const { useDownloadStore } = await import('@/context/useDownloadStore');
          let nativeTrack: import('@/lib/playback/native/RaagaXNativeDownload').NativeDownloadedTrack | undefined = useDownloadStore.getState().nativeDownloadedTracks[song.id];
          if (!nativeTrack) {
            const allNative = await RaagaXNativeDownload.getDownloadedTracks();
            const trackMap: Record<string, import('@/lib/playback/native/RaagaXNativeDownload').NativeDownloadedTrack> = {};
            const verifiedIds: string[] = [];
            allNative.forEach(t => {
              const sid = t.songId || t.id;
              if (sid) {
                trackMap[sid] = t;
                verifiedIds.push(sid);
              }
            });
            useDownloadStore.setState({ nativeDownloadedTracks: trackMap });
            usePlayerStore.setState(s => ({ downloadedSongIds: Array.from(new Set([...s.downloadedSongIds, ...verifiedIds])) }));
            nativeTrack = trackMap[song.id] || allNative.find(t => t.songId === song.id || t.id === song.id);
          }
          if (nativeTrack?.localPath) {
            const rawPath = nativeTrack.localPath;
            const fileUri = rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`;
            console.log(`[PlaybackSourceResolver] Playing verified native offline MP3: "${rawPath}" -> "${fileUri}"`);
            return {
              type: 'offline',
              url: fileUri,
              canonicalUrl: fileUri,
              mediaId: song.id,
              localId: song.id,
              isLocalBlob: false,
              isCached: false,
            };
          }
        }
      } catch (e) {
        console.warn('[PlaybackSourceResolver] Native offline check fallback:', e);
      }

      // 1b. Check direct file:// or /storage/ audioUrl on song
      if (song.audioUrl && (song.audioUrl.startsWith('file://') || song.audioUrl.startsWith('/storage/') || song.audioUrl.startsWith('/data/'))) {
        const fileUri = song.audioUrl.startsWith('file://') ? song.audioUrl : `file://${song.audioUrl}`;
        console.log(`[PlaybackSourceResolver] Playing direct local file audioUrl: "${fileUri}"`);
        return {
          type: 'offline',
          url: fileUri,
          canonicalUrl: fileUri,
          mediaId: song.id,
          localId: song.id,
          isLocalBlob: false,
          isCached: false,
        };
      }

      // 2. Check Local Sandboxed / Offline Storage (Web / PWA)
      const catalog = OfflineCatalog.getInstance();
      const storage = DownloadStorage.getInstance();

      const isCatalogDownloaded = await catalog.isDownloaded(song.id);
      const hasMediaBlob = await storage.hasMedia(song.id);

      if (isCatalogDownloaded || hasMediaBlob) {
        let localUrl = await storage.getMediaUrl(song.id);
        
        // Fallback check in PWA cache
        if (!localUrl && song.audioUrl) {
          localUrl = await getCachedAudioUrl(song.audioUrl);
        }

        if (localUrl) {
          // Record offline listening history & play count locally
          catalog.updatePlayStats(song.id).catch(() => {});

          // Resolve local artwork if offline
          const localArt = await storage.getArtworkUrl(song.id);
          if (localArt) {
            song.coverUrl = localArt;
          }

          PlayableUrlCache.getInstance().set(song.id, localUrl, [localUrl], 'offline', undefined, true);

          return {
            type: 'offline',
            url: localUrl,
            canonicalUrl: localUrl,
            mediaId: song.id,
            localId: song.id,
            isLocalBlob: true,
            isCached: false,
          };
        }
      }

      // If offline and song is not in downloaded folder:
      console.warn(`[PlaybackSourceResolver] Song unavailable offline: "${song.title}"`);
      return null;
    }

    // ── ONLINE MODE: Resolve via Existing Online Resolver & Stream Engine ────
    // 1. Check in-memory URL cache if not explicitly bypassed
    if (!bypassCache) {
      const cached = PlayableUrlCache.getInstance().get(song.id);
      if (cached && cached.url && cached.type !== 'offline') {
        return {
          type: 'remote',
          url: cached.url,
          canonicalUrl: cached.url,
          candidates: cached.candidates,
          videoId: song.id,
          isCached: true,
        };
      }
    }

    // ── 5. Quality Negotiation for Online Streaming ──────────────────────────
    try {
      const qualityDecision = await QualityManager.getInstance().getTargetQuality();
      usePlayerStore.getState().setDeliveredQuality(qualityDecision.target);
    } catch {}

    // ── 6. Direct Valid HTTPS Stream Check & Dynamic Lookup ──────────────────
    let validAudioUrl = song.audioUrl ? song.audioUrl.replace('http://', 'https://') : '';
    const isPixabay = validAudioUrl.includes('pixabay.com');

    if (!validAudioUrl || isPixabay || bypassCache) {
      try {
        const query = `${song.title} ${song.artist || ''}`.trim();
        console.log(`[PlaybackSourceResolver] Resolving real audio stream for: "${query}" (bypassCache=${bypassCache})`);
        const realSongs = await RealMusicEngine.getInstance().searchRealSongs(query, 1);
        
        if (realSongs.length > 0 && realSongs[0].audioUrl && !realSongs[0].audioUrl.includes('pixabay.com')) {
          validAudioUrl = realSongs[0].audioUrl.replace('http://', 'https://');
          song.audioUrl = validAudioUrl;
          if (realSongs[0].coverUrl) {
            song.coverUrl = realSongs[0].coverUrl.replace('http://', 'https://').replace(/150x150|50x50|300x300/g, '500x500');
          }
        }
      } catch (err) {
        console.warn(`[PlaybackSourceResolver] Stream resolution failed for "${song.title}":`, err);
      }
    }

    if (validAudioUrl && !validAudioUrl.includes('pixabay.com')) {
      const candidates = this.buildBitrateCandidates(validAudioUrl);
      const selectedUrl = candidates[0] || validAudioUrl;

      // Cache resolved stream URL for instantaneous sub-millisecond future hits
      PlayableUrlCache.getInstance().set(song.id, selectedUrl, candidates, 'remote');

      return {
        type: 'remote',
        url: selectedUrl,
        canonicalUrl: selectedUrl,
        candidates,
        videoId: song.id,
        isCached: false,
      };
    }

    return null;
  }

  private buildBitrateCandidates(primaryUrl: string): string[] {
    if (!primaryUrl) return [];
    const normalized = primaryUrl.replace(/^http:\/\//, 'https://');
    const candidates: string[] = [normalized];
    
    const bitrateRegex = /_(?:12|48|96|160|320|preview)(?=\.[a-z0-9]+$|$)/i;
    if (bitrateRegex.test(normalized)) {
      const desiredQualities = ['_320', '_160', '_96', '_48'];
      for (const q of desiredQualities) {
        const altUrl = normalized.replace(bitrateRegex, q);
        if (!candidates.includes(altUrl)) {
          candidates.push(altUrl);
        }
      }
    }
    return candidates;
  }
}


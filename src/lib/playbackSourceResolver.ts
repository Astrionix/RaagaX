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

  public async resolvePlayableSource(song: Song): Promise<PlaybackSource | null> {
    if (!song || !song.id) {
      return null;
    }

    const networkMode = NetworkManager.getInstance().getMode();
    const isOfflineForced = networkMode === 'offline_forced';
    const isOffline = networkMode === 'offline' || isOfflineForced || (typeof navigator !== 'undefined' && navigator.onLine === false);

    // ── 1. Check Native Android Physical Music/RaagaX Storage First ────────
    try {
      const { RaagaXNativeDownload } = await import('@/lib/playback/native/RaagaXNativeDownload');
      if (RaagaXNativeDownload.isNative()) {
        const { useDownloadStore } = await import('@/context/useDownloadStore');
        const nativeTrack = useDownloadStore.getState().nativeDownloadedTracks[song.id];
        if (nativeTrack?.localPath) {
          const { Capacitor } = await import('@capacitor/core');
          const playableUrl = Capacitor.isNativePlatform()
            ? Capacitor.convertFileSrc(nativeTrack.localPath)
            : (nativeTrack.localPath.startsWith('file://') ? nativeTrack.localPath : `file://${nativeTrack.localPath}`);
          console.log(`[PlaybackSourceResolver] Playing verified native offline MP3: "${nativeTrack.localPath}" -> "${playableUrl}"`);
          return {
            type: 'offline',
            url: playableUrl,
            mediaId: song.id,
            localId: song.id,
            isLocalBlob: false,
          };
        }
      }
    } catch (e) {
      console.warn('[PlaybackSourceResolver] Native offline check fallback:', e);
    }

    // ── 2. Check Local Sandboxed / Offline Storage (Web / PWA) ───────────────
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

        PlayableUrlCache.getInstance().set(song.id, localUrl, [localUrl], 'offline', undefined, true);

        return {
          type: 'offline',
          url: localUrl,
          mediaId: song.id,
          localId: song.id,
          isLocalBlob: true,
        };
      }
    }

    // ── 3. Check High-Speed In-Memory & Persistent URL Cache (0ms) ───────────
    const cached = PlayableUrlCache.getInstance().get(song.id);
    if (cached && cached.url && (!isOffline || cached.type === 'offline')) {
      return {
        type: cached.type,
        url: cached.url,
        candidates: cached.candidates,
        videoId: song.id,
        mediaId: song.id,
        isLocalBlob: cached.isLocalBlob,
      };
    }

    // ── 4. If Offline Mode is Active and Track is Not Downloaded ─────────────
    if (isOffline) {
      console.warn(`[PlaybackSourceResolver] Song unavailable offline: "${song.title}"`);
      return null;
    }

    // ── 5. Quality Negotiation for Online Streaming ──────────────────────────
    try {
      const qualityDecision = await QualityManager.getInstance().getTargetQuality();
      usePlayerStore.getState().setDeliveredQuality(qualityDecision.target);
    } catch {}

    // ── 6. Direct Valid HTTPS Stream Check & Dynamic Lookup ──────────────────
    let validAudioUrl = song.audioUrl ? song.audioUrl.replace('http://', 'https://') : '';
    const isPixabay = validAudioUrl.includes('pixabay.com');

    if (!validAudioUrl || isPixabay) {
      try {
        const query = `${song.title} ${song.artist || ''}`.trim();
        console.log(`[PlaybackSourceResolver] Resolving real audio stream for: "${query}"`);
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
        candidates,
        videoId: song.id,
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


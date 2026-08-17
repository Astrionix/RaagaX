import { Song } from '@/types/music';
import { getApiUrl } from '@/lib/config/apiConfig';

export const OFFLINE_AUDIO_CACHE_NAME = 'raagax-offline-audio-v1';

/**
 * Downloads high quality 320kbps audio file directly to user's internal PWA cache
 * or local device depending on platform.
 */
export async function downloadSongFile(
  song: Song, 
  signal?: AbortSignal,
  onProgress?: (progress: number, downloadedBytes: number, totalBytes: number) => void,
  startOffset: number = 0
): Promise<boolean> {
  if (!song || !song.audioUrl) return false;

  const sanitizeName = (str: string) => str.replace(/[/\\?%*:|"<>]/g, '').trim();
  const filename = `${sanitizeName(song.title)} - ${sanitizeName(song.artist || 'Artist')}.mp3`;
  const downloadProxyUrl = getApiUrl(`/api/download?url=${encodeURIComponent(song.audioUrl)}&name=${encodeURIComponent(filename)}`);

  // True PWA Offline Caching Strategy
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      
      // Check if already cached completely
      const existing = await cache.match(song.audioUrl);
      if (existing) {
        if (onProgress) onProgress(100, 0, 0);
        return true;
      }

      // Prepare headers for Range request if we are resuming
      const headers = new Headers();
      if (startOffset > 0) {
        headers.append('Range', `bytes=${startOffset}-`);
      }

      const response = await fetch(downloadProxyUrl, { signal, headers });
      if (response.ok || response.status === 206) {
        const contentLength = response.headers.get('content-length');
        let total = contentLength ? parseInt(contentLength, 10) : 0;
        
        if (response.status === 206 && total > 0) {
          total += startOffset;
        }

        let loaded = startOffset;
        let lastProgressTime = 0;
        
        if (!response.body) return false;
        
        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          if (value) {
            chunks.push(value);
            loaded += value.length;
            
            const now = Date.now();
            if (now - lastProgressTime > 250) {
              if (total > 0 && onProgress) {
                onProgress(Math.floor((loaded / total) * 100), loaded, total);
              } else if (onProgress) {
                const mockTotal = 5 * 1024 * 1024;
                onProgress(Math.min(99, Math.floor((loaded / mockTotal) * 100)), loaded, mockTotal);
              }
              lastProgressTime = now;
            }
          }
        }
        
        if (onProgress) onProgress(100, loaded, total || loaded);

        const blob = new Blob(chunks, { type: 'audio/mpeg' });
        const finalResponse = new Response(blob, {
          headers: { 'Content-Type': 'audio/mpeg' }
        });

        await cache.put(song.audioUrl, finalResponse);
        
        if (song.coverUrl) {
          try {
            const imgResponse = await fetch(song.coverUrl);
            if (imgResponse.ok) await cache.put(song.coverUrl, imgResponse);
          } catch {}
        }
        
        return true;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw e;
      }
      console.error('[OfflineStorage] Failed to cache audio for offline playback:', e);
      throw e;
    }
  }

  return false;
}

/**
 * Mode B — Exports an audio track as a standard standalone MP3 file directly to the user's
 * shared Downloads / Music directory on device or laptop.
 */
export async function exportSongToDevice(song: Song): Promise<boolean> {
  if (!song) return false;

  const sanitizeName = (str: string) => str.replace(/[/\\?%*:|"<>]/g, '').trim();
  const filename = `${sanitizeName(song.title)} - ${sanitizeName(song.artist || 'Artist')}.mp3`;
  
  let targetUrl = song.audioUrl;
  if (!targetUrl || targetUrl.includes('pixabay.com')) {
    targetUrl = getApiUrl(`/api/download?id=${encodeURIComponent(song.id)}&name=${encodeURIComponent(filename)}`);
  } else {
    targetUrl = getApiUrl(`/api/download?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(filename)}`);
  }

  try {
    if (typeof document !== 'undefined') {
      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      anchor.href = targetUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        document.body.removeChild(anchor);
      }, 1500);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[DownloadHelper] Mode B export failed:', err);
    return false;
  }
}

/**
 * Removes a song from the internal PWA Cache
 */
export async function removeCachedSong(song: Song): Promise<void> {
  if (!song || !song.audioUrl) return;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      await cache.delete(song.audioUrl);
      console.log(`[OfflineStorage] Removed ${song.title} from cache`);
    } catch (e) {
      console.error('[OfflineStorage] Failed to remove cached song:', e);
    }
  }
}

/**
 * Checks if a song is cached in CacheStorage and returns a local object URL for offline playback.
 */
export async function getCachedAudioUrl(audioUrl: string): Promise<string | null> {
  if (!audioUrl || typeof window === 'undefined' || !('caches' in window)) return null;
  
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const response = await cache.match(audioUrl);
    
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.error('[OfflineStorage] Failed to retrieve cached audio:', e);
  }
  
  return null;
}

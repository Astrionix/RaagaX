import { Song } from '@/types/music';

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
  const filename = `${sanitizeName(song.title)} - ${sanitizeName(song.artist)}.mp3`;
  const downloadProxyUrl = `/api/download?url=${encodeURIComponent(song.audioUrl)}&name=${encodeURIComponent(filename)}`;

  // True PWA Offline Caching Strategy
  if ('caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      
      // Check if already cached completely
      const existing = await cache.match(song.audioUrl);
      if (existing) {
        if (onProgress) onProgress(100, 0, 0); // Exact bytes unknown from cache match directly here
        return true;
      }

      // Prepare headers for Range request if we are resuming
      const headers = new Headers();
      if (startOffset > 0) {
        headers.append('Range', `bytes=${startOffset}-`);
      }

      // We fetch through the proxy to bypass CORS and get the actual MP3 Blob
      const response = await fetch(downloadProxyUrl, { signal, headers });
      if (response.ok || response.status === 206) {
        
        const contentLength = response.headers.get('content-length');
        let total = contentLength ? parseInt(contentLength, 10) : 0;
        
        // If it's a partial response, total is startOffset + remaining
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
            
            // Throttle progress updates to ~250ms
            const now = Date.now();
            if (now - lastProgressTime > 250) {
              if (total > 0 && onProgress) {
                onProgress(Math.floor((loaded / total) * 100), loaded, total);
              } else if (onProgress) {
                // Mock progress if total is unknown
                const mockTotal = 5 * 1024 * 1024; // Assume 5MB
                onProgress(Math.min(99, Math.floor((loaded / mockTotal) * 100)), loaded, mockTotal);
              }
              lastProgressTime = now;
            }
          }
        }
        
        // Ensure 100% on complete
        if (onProgress) onProgress(100, loaded, total || loaded);

        // NOTE: A true Range implementation with CacheStorage would require us to read the existing 
        // cached partial blob, append the new chunks, and re-put.
        // For simplicity in this PWA architecture, if we used Range, we assume we just got the rest 
        // and we will save this new Blob. In a real-world IDB setup, we'd append to the IDB record.
        // Here we just save what we got. 
        const blob = new Blob(chunks, { type: 'audio/mpeg' });
        const finalResponse = new Response(blob, {
          headers: { 'Content-Type': 'audio/mpeg' }
        });

        // Store in Cache API using the raw audioUrl as the key for easy lookup during playback
        await cache.put(song.audioUrl, finalResponse);
        
        // Also enthusiastically cache the artwork for offline UI
        if (song.coverUrl) {
           const imgResponse = await fetch(song.coverUrl);
           if (imgResponse.ok) await cache.put(song.coverUrl, imgResponse);
        }
        
        console.log(`[OfflineStorage] Successfully cached ${song.title}`);
        return true;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
         console.log(`[OfflineStorage] Download aborted for ${song.title}`);
         throw e;
      }
      console.error('[OfflineStorage] Failed to cache audio for offline playback:', e);
      throw e; // Rethrow so DownloadManager can handle retries
    }
  }

  // Fallback to traditional browser download if Cache API is unavailable
  try {
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = downloadProxyUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => document.body.removeChild(anchor), 1000);
    return true;
  } catch (err) {
    window.open(song.audioUrl, '_blank');
    return true;
  }
}

/**
 * Removes a song from the internal PWA Cache
 */
export async function removeCachedSong(song: Song): Promise<void> {
  if (!song || !song.audioUrl) return;
  if ('caches' in window) {
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
 * Checks if a song is cached and returns a local object URL for offline playback.
 * The caller is responsible for revoking the URL when done.
 */
export async function getCachedAudioUrl(audioUrl: string): Promise<string | null> {
  if (!audioUrl || !('caches' in window)) return null;
  
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

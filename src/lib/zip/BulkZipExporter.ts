import { Song } from '@/types/music';
import { ZipBuilder, ZipEntry } from './ZipBuilder';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { SongFormatter } from '@/lib/music/SongFormatter';

export interface ZipExportProgress {
  completed: number;
  total: number;
  currentSongTitle: string;
  percent: number;
}

export class BulkZipExporter {
  /**
   * Bundles all songs in a playlist or collection into a single .zip file.
   * Leverages offline IndexedDB cache when available, fetches missing audio over network.
   */
  public static async exportPlaylistAsZip(
    songs: Song[],
    collectionTitle: string = 'Playlist',
    onProgress?: (progress: ZipExportProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<{ success: boolean; filename: string; totalBytes: number; blob: Blob }> {
    if (!songs || songs.length === 0) {
      throw new Error('No songs provided to export');
    }

    const safeTitle = (collectionTitle || 'Music')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim();
    const zipFilename = `RaagaX - ${safeTitle}.zip`;

    const storage = DownloadStorage.getInstance();
    const entries: ZipEntry[] = [];
    const total = songs.length;

    const sanitize = (name: string) =>
      (name || '').replace(/[/\\?%*:|"<>]/g, '_').trim();

    for (let i = 0; i < total; i++) {
      if (abortSignal?.aborted) {
        throw new Error('ZIP export cancelled');
      }

      const song = songs[i];
      const cleanTitle = SongFormatter.cleanSongTitle(song.title || 'Track');
      const cleanArtist = sanitize(song.artist || 'Artist');
      const entryName = `${cleanTitle} - ${cleanArtist}.mp3`;

      if (onProgress) {
        onProgress({
          completed: i,
          total,
          currentSongTitle: cleanTitle,
          percent: Math.round((i / total) * 100),
        });
      }

      try {
        let audioArrayBuffer: ArrayBuffer | null = null;

        // 1. Check local IndexedDB storage first (Instant cache hit with 0 network usage)
        try {
          const cachedBlob = await storage.getMediaBlob(song.id);
          if (cachedBlob && cachedBlob.size > 1024) {
            audioArrayBuffer = await cachedBlob.arrayBuffer();
          }
        } catch { }

        // 2. If missing from cache, fetch audio via network
        if (!audioArrayBuffer) {
          if (abortSignal?.aborted) {
            throw new Error('ZIP export cancelled');
          }

          let downloadUrl = song.audioUrl;
          if (!downloadUrl || downloadUrl.includes('pixabay.com') || downloadUrl.startsWith('blob:') || downloadUrl.startsWith('file:')) {
            try {
              const { PlaybackSourceResolver } = await import('@/lib/playbackSourceResolver');
              const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
              if (source?.url && !source.url.startsWith('blob:') && !source.url.startsWith('file:')) {
                downloadUrl = source.url;
              }
            } catch { }
          }

          const targetUrl = downloadUrl && !downloadUrl.includes('pixabay.com')
            ? `/api/download?url=${encodeURIComponent(downloadUrl)}&name=${encodeURIComponent(entryName)}`
            : `/api/download?id=${encodeURIComponent(song.id)}&name=${encodeURIComponent(entryName)}`;

          const resp = await fetch(targetUrl, { signal: abortSignal });
          if (resp.ok) {
            audioArrayBuffer = await resp.arrayBuffer();
          }
        }

        if (audioArrayBuffer && audioArrayBuffer.byteLength > 0) {
          entries.push({
            name: entryName,
            data: audioArrayBuffer,
          });
        }
      } catch (songErr: any) {
        if (abortSignal?.aborted || songErr?.name === 'AbortError') {
          throw new Error('ZIP export cancelled');
        }
        console.warn(`[BulkZipExporter] Failed to include track "${song.title}" in ZIP:`, songErr);
      }
    }

    if (abortSignal?.aborted) {
      throw new Error('ZIP export cancelled');
    }

    if (entries.length === 0) {
      throw new Error('Could not download audio streams for the selected songs.');
    }

    if (onProgress) {
      onProgress({
        completed: total,
        total,
        currentSongTitle: 'Packaging ZIP archive...',
        percent: 100,
      });
    }

    // Build the ZIP Blob
    const zipBlob = ZipBuilder.buildZip(entries);

    return {
      success: true,
      filename: zipFilename,
      totalBytes: zipBlob.size,
      blob: zipBlob,
    };
  }

  /**
   * Safely prompts and initiates download of the generated ZIP file.
   * Works reliably across Electron desktop, system server flat save, and browser download.
   */
  public static triggerDownload(zipBlob: Blob, filename: string): void {
    if (!zipBlob) return;

    // 1. Electron Desktop IPC or Node Flat Server Save
    try {
      if (typeof window !== 'undefined' && (window as any).raagaXDesktop?.saveSongFile) {
        zipBlob.arrayBuffer().then((buf) => {
          (window as any).raagaXDesktop.saveSongFile(filename, buf);
        }).catch(() => {});
      } else if (typeof fetch !== 'undefined') {
        const formData = new FormData();
        formData.append('file', zipBlob, filename);
        formData.append('filename', filename);
        fetch('/api/system/save-song', {
          method: 'POST',
          body: formData,
        }).catch(() => {});
      }
    } catch (saveErr) {
      console.warn('[BulkZipExporter] Disk save note:', saveErr);
    }

    // 2. Direct browser file download prompt
    if (typeof document !== 'undefined') {
      const blobUrl = URL.createObjectURL(zipBlob);
      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();

      setTimeout(() => {
        try {
          document.body.removeChild(anchor);
          URL.revokeObjectURL(blobUrl);
        } catch {}
      }, 15000);
    }
  }
}

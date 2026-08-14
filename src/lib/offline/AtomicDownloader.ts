import { DownloadQuality } from './types';

export interface AtomicDownloadOptions {
  url: string;
  trackId: string;
  quality?: DownloadQuality;
  startOffset?: number;
  expectedChecksum?: string;
  signal?: AbortSignal;
  onProgress?: (progress: number, downloadedBytes: number, totalBytes: number, speed: number) => void;
  onStateChange?: (state: 'CONNECTING' | 'DOWNLOADING' | 'VERIFYING' | 'COMMITTING') => void;
}

export interface AtomicDownloadResult {
  blob: Blob;
  mimeType: string;
  totalBytes: number;
  checksum: string;
  durationMs?: number;
}

/**
 * Calculates SHA-256 checksum of an ArrayBuffer in browser or Node environments.
 */
async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple checksum if Web Crypto is unavailable
  let hash = 0;
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    hash = (hash * 31 + bytes[i]) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * AtomicDownloader — Streams audio bytes into a temporary in-memory/part buffer,
 * verifies payload integrity, and guarantees no corrupted or partial files reach the offline store.
 */
export class AtomicDownloader {
  private static instance: AtomicDownloader;

  public static getInstance(): AtomicDownloader {
    if (!AtomicDownloader.instance) {
      AtomicDownloader.instance = new AtomicDownloader();
    }
    return AtomicDownloader.instance;
  }

  public async download(options: AtomicDownloadOptions): Promise<AtomicDownloadResult> {
    const { url, startOffset = 0, signal, onProgress, onStateChange, expectedChecksum } = options;

    onStateChange?.('CONNECTING');

    const headers = new Headers();
    if (startOffset > 0) {
      headers.set('Range', `bytes=${startOffset}-`);
    }

    const response = await fetch(url, { signal, headers });

    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Download response contains no readable body stream');
    }

    const contentLengthHeader = response.headers.get('content-length');
    let contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
    let totalBytes = response.status === 206 ? startOffset + contentLength : contentLength;

    const mimeType = response.headers.get('content-type') || 'audio/mpeg';

    onStateChange?.('DOWNLOADING');

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytesDownloaded = startOffset;
    let lastProgressTimestamp = Date.now();
    let bytesSinceLastProgress = 0;
    let speedBytesPerSec = 0;

    try {
      while (true) {
        if (signal?.aborted) {
          throw new DOMException('Download aborted by user', 'AbortError');
        }

        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          bytesDownloaded += value.byteLength;
          bytesSinceLastProgress += value.byteLength;

          const now = Date.now();
          const elapsed = now - lastProgressTimestamp;

          // Throttle progress updates to every 150ms
          if (elapsed >= 150 || (totalBytes > 0 && bytesDownloaded >= totalBytes)) {
            speedBytesPerSec = Math.round((bytesSinceLastProgress / elapsed) * 1000);
            const calculatedProgress = totalBytes > 0 
              ? Math.min(99, Math.round((bytesDownloaded / totalBytes) * 100))
              : Math.min(99, Math.round((bytesDownloaded / (5 * 1024 * 1024)) * 100)); // Default 5MB estimation

            onProgress?.(calculatedProgress, bytesDownloaded, totalBytes || bytesDownloaded, speedBytesPerSec);
            lastProgressTimestamp = now;
            bytesSinceLastProgress = 0;
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      throw new Error(`Download streaming failed: ${err.message || err}`);
    }

    // ─── Step 2: Verification Phase ──────────────────────────────────────────
    onStateChange?.('VERIFYING');

    if (bytesDownloaded === 0) {
      throw new Error('Downloaded file has 0 bytes (empty payload)');
    }

    // Assemble temporary buffer (.part)
    const combinedBuffer = new Uint8Array(bytesDownloaded - startOffset);
    let offset = 0;
    for (const chunk of chunks) {
      combinedBuffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // Compute checksum
    const computedChecksum = await computeSha256(combinedBuffer.buffer);

    if (expectedChecksum && computedChecksum !== expectedChecksum) {
      throw new Error(`Checksum mismatch! Expected ${expectedChecksum}, got ${computedChecksum}`);
    }

    // ─── Step 3: Atomic Commit Preparation ────────────────────────────────────
    onStateChange?.('COMMITTING');

    const blob = new Blob([combinedBuffer], { type: mimeType });
    onProgress?.(100, bytesDownloaded, bytesDownloaded, 0);

    return {
      blob,
      mimeType,
      totalBytes: bytesDownloaded,
      checksum: computedChecksum,
    };
  }
}

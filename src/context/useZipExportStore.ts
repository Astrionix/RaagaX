import { create } from 'zustand';
import { Song } from '@/types/music';
import { BulkZipExporter, ZipExportProgress } from '@/lib/zip/BulkZipExporter';
import { usePlayerStore } from '@/context/usePlayerStore';
import { haptics } from '@/lib/haptics/HapticEngine';

export interface ZipExportResult {
  blob: Blob;
  blobUrl: string;
  filename: string;
  totalBytes: number;
  totalSongs: number;
  collectionTitle: string;
  completedAt: number;
}

interface ZipExportStore {
  isExporting: boolean;
  activeCollectionId: string | null;
  activeCollectionTitle: string;
  progress: number;
  currentSongTitle: string;
  completedSongs: number;
  totalSongs: number;

  zipResult: ZipExportResult | null;
  showDownloadPrompt: boolean;
  error: string | null;
  abortController: AbortController | null;

  startZipExport: (songs: Song[], collectionTitle: string, collectionId?: string) => Promise<void>;
  cancelZipExport: () => void;
  downloadZipResult: () => void;
  dismissDownloadPrompt: () => void;
  clearResult: () => void;
}

export const useZipExportStore = create<ZipExportStore>((set, get) => ({
  isExporting: false,
  activeCollectionId: null,
  activeCollectionTitle: '',
  progress: 0,
  currentSongTitle: '',
  completedSongs: 0,
  totalSongs: 0,

  zipResult: null,
  showDownloadPrompt: false,
  error: null,
  abortController: null,

  startZipExport: async (songs: Song[], collectionTitle: string, collectionId: string = 'collection') => {
    const state = get();
    if (state.isExporting) {
      usePlayerStore.getState().setToastMessage(`ZIP packaging already in progress for "${state.activeCollectionTitle}"`);
      return;
    }

    if (!songs || songs.length === 0) {
      usePlayerStore.getState().setToastMessage('No songs available in this collection to ZIP.');
      return;
    }

    // Clean up previous blob URL if needed
    if (state.zipResult?.blobUrl) {
      try {
        URL.revokeObjectURL(state.zipResult.blobUrl);
      } catch {}
    }

    const abortController = new AbortController();

    set({
      isExporting: true,
      activeCollectionId: collectionId,
      activeCollectionTitle: collectionTitle,
      progress: 0,
      currentSongTitle: 'Preparing audio files...',
      completedSongs: 0,
      totalSongs: songs.length,
      zipResult: null,
      showDownloadPrompt: false,
      error: null,
      abortController,
    });

    haptics.mediumImpact();
    usePlayerStore.getState().setToastMessage(`📦 Packaging ${songs.length} tracks into ZIP in background...`);

    try {
      const res = await BulkZipExporter.exportPlaylistAsZip(
        songs,
        collectionTitle,
        (p: ZipExportProgress) => {
          set({
            progress: p.percent,
            completedSongs: p.completed,
            totalSongs: p.total,
            currentSongTitle: p.currentSongTitle,
          });
        },
        abortController.signal
      );

      const blobUrl = URL.createObjectURL(res.blob);
      const zipResult: ZipExportResult = {
        blob: res.blob,
        blobUrl,
        filename: res.filename,
        totalBytes: res.totalBytes,
        totalSongs: songs.length,
        collectionTitle,
        completedAt: Date.now(),
      };

      set({
        isExporting: false,
        progress: 100,
        activeCollectionId: null,
        zipResult,
        showDownloadPrompt: true, // Prompt modal opens asking user to download
        abortController: null,
      });

      haptics.successNotification();

      // Trigger automatic save/download attempt as well
      try {
        BulkZipExporter.triggerDownload(res.blob, res.filename);
      } catch (autoErr) {
        console.warn('[ZipExportStore] Auto-download note:', autoErr);
      }

      usePlayerStore.getState().setToastMessage(`✓ ZIP archive ready: ${res.filename} (${(res.totalBytes / (1024 * 1024)).toFixed(1)} MB)`);
    } catch (err: any) {
      if (abortController.signal.aborted) {
        usePlayerStore.getState().setToastMessage('ZIP export cancelled');
        set({
          isExporting: false,
          activeCollectionId: null,
          abortController: null,
          progress: 0,
        });
        return;
      }

      console.error('[ZipExportStore] Failed to export ZIP:', err);
      set({
        isExporting: false,
        activeCollectionId: null,
        error: err.message || 'Failed to export ZIP',
        abortController: null,
        progress: 0,
      });
      usePlayerStore.getState().setToastMessage(`ZIP failed: ${err.message || 'Audio fetch error'}`);
    }
  },

  cancelZipExport: () => {
    const { abortController, activeCollectionTitle } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      isExporting: false,
      activeCollectionId: null,
      abortController: null,
      progress: 0,
    });
    usePlayerStore.getState().setToastMessage(`Cancelled ZIP export for "${activeCollectionTitle}"`);
  },

  downloadZipResult: () => {
    const { zipResult } = get();
    if (!zipResult) return;
    haptics.mediumImpact();
    BulkZipExporter.triggerDownload(zipResult.blob, zipResult.filename);
    usePlayerStore.getState().setToastMessage(`Downloading "${zipResult.filename}"...`);
  },

  dismissDownloadPrompt: () => {
    set({ showDownloadPrompt: false });
  },

  clearResult: () => {
    const { zipResult } = get();
    if (zipResult?.blobUrl) {
      try {
        URL.revokeObjectURL(zipResult.blobUrl);
      } catch {}
    }
    set({ zipResult: null, showDownloadPrompt: false });
  },
}));

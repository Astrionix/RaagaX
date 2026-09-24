'use client';

import React from 'react';
import { Archive, Download, CheckCircle2, X, FolderOpen, Loader2, Sparkles, Music2 } from 'lucide-react';
import { useZipExportStore } from '@/context/useZipExportStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export function ZipExportGlobalOverlay() {
  const {
    isExporting,
    activeCollectionTitle,
    progress,
    currentSongTitle,
    completedSongs,
    totalSongs,
    zipResult,
    showDownloadPrompt,
    cancelZipExport,
    downloadZipResult,
    dismissDownloadPrompt,
  } = useZipExportStore();

  // Lock body scroll when Zip Download Prompt modal is displayed
  useBodyScrollLock(Boolean(showDownloadPrompt && zipResult));

  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).raagaXDesktop);

  const handleOpenFolder = () => {
    if (typeof window !== 'undefined' && (window as any).raagaXDesktop?.openDownloadsFolder) {
      (window as any).raagaXDesktop.openDownloadsFolder();
    }
  };

  return (
    <>
      {/* ── 1. Floating Background Progress Card ── */}
      {isExporting && (
        <div
          className="fixed bottom-24 sm:bottom-28 right-3 sm:right-6 z-50 w-[calc(100%-1.5rem)] sm:w-96 bg-[#0c0e16]/95 border border-amber-500/30 rounded-2xl p-3.5 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom-4 duration-300 text-white"
          style={{
            boxShadow: '0 10px 40px -10px rgba(245, 158, 11, 0.25), 0 0 20px rgba(0,0,0,0.8)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative flex-shrink-0 w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Archive className="w-4 h-4 animate-pulse text-amber-400" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-white truncate">
                    Zipping: {activeCollectionTitle}
                  </p>
                  <span className="text-[11px] font-mono font-bold text-amber-400">
                    {progress}%
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                  {completedSongs}/{totalSongs} songs • {currentSongTitle || 'Processing...'}
                </p>
              </div>
            </div>

            <button
              onClick={cancelZipExport}
              title="Cancel ZIP export"
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2.5">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-[#FA233B] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── 2. ZIP Ready / Download Prompt Modal ── */}
      {showDownloadPrompt && zipResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md bg-[#0e111a]/95 border border-white/15 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl text-center overflow-hidden animate-in zoom-in-95 duration-200"
            style={{
              boxShadow: '0 25px 60px -15px rgba(250, 35, 59, 0.35), 0 0 30px rgba(0,0,0,0.9)',
            }}
          >
            {/* Top decorative ambient glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-br from-[#FA233B]/30 to-amber-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={dismissDownloadPrompt}
              className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-wide uppercase mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ZIP Archive Ready</span>
            </div>

            {/* Central Icon */}
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-[#FA233B]/20 border border-white/15 flex items-center justify-center mb-4">
              <Archive className="w-8 h-8 text-amber-400" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0e111a] flex items-center justify-center text-white">
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
              </div>
            </div>

            <h3 className="text-xl font-black text-white tracking-tight mb-1">
              Your ZIP is Ready to Download
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-5 max-w-sm mx-auto">
              All <strong className="text-white">{zipResult.totalSongs} tracks</strong> from{' '}
              <strong className="text-white">"{zipResult.collectionTitle}"</strong> have been packaged.
            </p>

            {/* File info card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-5 text-left flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Music2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono font-bold text-white truncate" title={zipResult.filename}>
                  {zipResult.filename}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {(zipResult.totalBytes / (1024 * 1024)).toFixed(1)} MB • Lossless Offline Archive
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={downloadZipResult}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#FA233B] to-[#FF5252] hover:from-[#e01e35] hover:to-[#ff3b3b] text-white font-bold text-sm shadow-lg shadow-red-500/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download ZIP Now</span>
              </button>

              {isDesktop && (
                <button
                  onClick={handleOpenFolder}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[var(--text-secondary)] hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-cyan-400" />
                  <span>Open in Downloads Folder</span>
                </button>
              )}

              <button
                onClick={dismissDownloadPrompt}
                className="w-full py-2 text-xs font-medium text-[var(--text-muted)] hover:text-white transition-colors"
              >
                Dismiss
              </button>
            </div>

            <p className="text-[10px] text-[var(--text-muted)] mt-4">
              Tip: Click "Download ZIP Now" above if your browser did not automatically ask for download location.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

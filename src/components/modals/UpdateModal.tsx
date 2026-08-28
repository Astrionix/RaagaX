'use client';

import React from 'react';
import { useUpdateStore } from '@/context/useUpdateStore';
import { Download, AlertCircle, CheckCircle2, RefreshCw, X, Info } from 'lucide-react';

export function UpdateModal() {
  const {
    state,
    manifest,
    downloadProgress,
    error,
    showModal,
    isInstallPermissionRequested,
    startDownload,
    cancelDownload,
    installUpdate,
    closeModal
  } = useUpdateStore();

  if (!showModal || !manifest) return null;

  const isMandatory = manifest.mandatory || (
    useUpdateStore.getState().installedVersion &&
    useUpdateStore.getState().installedVersion!.versionCode < manifest.minimumSupportedVersion
  );

  const formattedSize = manifest.fileSize 
    ? (manifest.fileSize / (1024 * 1024)).toFixed(1) + ' MB' 
    : 'Unknown Size';

  const progressPercent = downloadProgress.percentage || 0;
  const progressDownloaded = (downloadProgress.downloadedBytes / (1024 * 1024)).toFixed(1);
  const progressTotal = (downloadProgress.totalBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-[#1C1C1E] sm:rounded-3xl rounded-t-3xl border border-white/10 shadow-2xl text-white flex flex-col max-h-[92dvh] sm:max-h-[85vh]">
        
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C] flex-shrink-0">
              <Download className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white">
                {isMandatory ? 'Required Update' : 'New Update Available'}
              </h3>
              <p className="text-[11px] text-slate-400">RaagaX version {manifest.versionName}</p>
            </div>
          </div>
          {!isMandatory && state !== 'DOWNLOADING' && state !== 'VERIFYING' && state !== 'INSTALLING' && (
            <button
              onClick={closeModal}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-4">
          {/* Status Message / Info Box */}
          {isMandatory && (
            <div className="p-3 bg-[#EF233C]/10 border border-[#EF233C]/30 rounded-xl flex items-start gap-2.5 text-xs text-[#EF233C]">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">
                This update is critical to keep streaming services running safely. It is required to continue using the application.
              </p>
            </div>
          )}

          {/* Release Notes */}
          {state !== 'DOWNLOADING' && state !== 'VERIFYING' && state !== 'INSTALLING' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                <span>Release Notes</span>
                <span>Size: {formattedSize}</span>
              </div>
              <div className="p-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl max-h-48 overflow-y-auto space-y-2">
                {manifest.releaseNotes && manifest.releaseNotes.length > 0 ? (
                  manifest.releaseNotes.map((note, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-[#EF233C] mt-0.5">•</span>
                      <p className="leading-relaxed">{note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No changelog notes provided.</p>
                )}
              </div>
            </div>
          )}

          {/* Downloading Progress Bar */}
          {state === 'DOWNLOADING' && (
            <div className="space-y-3 py-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-bold">Downloading APK installer...</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[#EF233C] h-full transition-all duration-150 rounded-full" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{progressDownloaded} MB / {progressTotal} MB</span>
                <span>Background-safe</span>
              </div>
            </div>
          )}

          {/* Verifying Spinner */}
          {state === 'VERIFYING' && (
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              <RefreshCw className="w-8 h-8 text-[#EF233C] animate-spin" />
              <p className="text-xs font-bold text-slate-300">Checking package integrity...</p>
              <p className="text-[10px] text-slate-500">Calculating SHA-256 checksum</p>
            </div>
          )}

          {/* Installing Status */}
          {state === 'INSTALLING' && (
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              <RefreshCw className="w-8 h-8 text-[#EF233C] animate-spin" />
              <p className="text-xs font-bold text-slate-300">Launching package installer...</p>
              <p className="text-[10px] text-slate-500">Please complete the Android installer dialog</p>
            </div>
          )}

          {/* Verified Checkbox */}
          {state === 'VERIFIED' && (
            <div className="flex flex-col items-center justify-center py-4 space-y-2 text-emerald-500">
              <CheckCircle2 className="w-10 h-10" />
              <p className="text-xs font-bold">APK verification passed!</p>
              <p className="text-[10px] text-slate-500 text-center px-4">
                Checksum hashes matched perfectly. Ready to update.
              </p>
            </div>
          )}

          {/* Permission Settings Tip */}
          {isInstallPermissionRequested && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-xs text-amber-500 leading-relaxed">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                Android requires you to grant install permission for RaagaX. Please toggle <strong>"Allow from this source"</strong> in settings, then return to complete installation.
              </p>
            </div>
          )}

          {/* Error Message Box */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4.5 h-4.5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-[11px] uppercase tracking-wider mb-0.5">Error: {error.code}</p>
                <p className="leading-relaxed">{error.message}</p>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex gap-3 pt-2">
            {state === 'UPDATE_AVAILABLE' && (
              <>
                {!isMandatory && (
                  <button
                    onClick={closeModal}
                    className="flex-1 py-3 text-xs font-extrabold bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
                  >
                    Later
                  </button>
                )}
                <button
                  onClick={startDownload}
                  className="flex-1 py-3 text-xs font-extrabold bg-[#EF233C] hover:bg-[#D90429] rounded-2xl transition-all shadow-lg shadow-[#EF233C]/20"
                >
                  {isMandatory ? 'Update Now' : 'Download Update'}
                </button>
              </>
            )}

            {state === 'DOWNLOADING' && !isMandatory && (
              <button
                onClick={cancelDownload}
                className="w-full py-3 text-xs font-extrabold bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
              >
                Cancel Download
              </button>
            )}

            {state === 'VERIFIED' && (
              <button
                onClick={installUpdate}
                className="w-full py-3 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 rounded-2xl transition-all shadow-lg shadow-emerald-600/20"
              >
                Install Now
              </button>
            )}

            {(state === 'DOWNLOAD_FAILED' || state === 'INSTALL_FAILED') && (
              <>
                {!isMandatory && (
                  <button
                    onClick={closeModal}
                    className="flex-1 py-3 text-xs font-extrabold bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
                  >
                    Close
                  </button>
                )}
                <button
                  onClick={state === 'DOWNLOAD_FAILED' ? startDownload : installUpdate}
                  className="flex-1 py-3 text-xs font-extrabold bg-[#EF233C] hover:bg-[#D90429] rounded-2xl transition-all shadow-lg shadow-[#EF233C]/20"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

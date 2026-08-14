import React, { useEffect, useState } from 'react';
import { useDownloadStore } from '@/context/useDownloadStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Download, HardDrive } from 'lucide-react';
import { Song } from '@/types/music';

export function BulkDownloadConfirmModal({ 
  isOpen, 
  onClose, 
  title,
  subtitle,
  coverUrl,
  songs
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string;
  subtitle: string;
  coverUrl: string;
  songs: Song[];
}) {
  const { downloadPlaylist, isOfflineStorageEnabled, setSetupModalOpen, wifiOnly, setWifiOnly } = useDownloadStore();
  const { downloadedSongIds } = usePlayerStore();
  
  const [storageAvailable, setStorageAvailable] = useState('...');
  const [quotaBytes, setQuotaBytes] = useState(0);

  useEffect(() => {
    if (isOpen && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        const quota = estimate.quota || 0;
        setQuotaBytes(quota);
        if (quota > 0) {
          setStorageAvailable((quota / (1024 ** 3)).toFixed(1) + ' GB');
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const alreadyDownloadedCount = songs.filter(s => downloadedSongIds.includes(s.id)).length;
  const toDownloadCount = songs.length - alreadyDownloadedCount;
  const estimatedBytes = toDownloadCount * 5 * 1024 * 1024; // ~5MB per song average

  const handleDownload = () => {
    if (!isOfflineStorageEnabled) {
      onClose();
      setSetupModalOpen(true);
      return;
    }
    const toDownload = songs.filter(s => !downloadedSongIds.includes(s.id));
    downloadPlaylist(toDownload);
    onClose();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#161618] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <img src={coverUrl} alt="Cover" className="w-16 h-16 rounded-xl object-cover shadow-lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white tracking-tight truncate">{title}</h2>
              <p className="text-sm text-slate-400 truncate">{subtitle}</p>
              <p className="text-xs text-slate-500 mt-1">{songs.length} songs</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Estimated download</span>
                <span className="font-bold text-white">{formatBytes(estimatedBytes)}</span>
              </div>
              
              <div className="h-px w-full bg-white/5" />
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 flex items-center gap-1.5"><HardDrive className="w-4 h-4" /> Device storage</span>
                <span className="font-bold text-emerald-400">{storageAvailable} available</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                <input type="checkbox" checked={wifiOnly} onChange={(e) => setWifiOnly(e.target.checked)} className="w-4 h-4 rounded border-white/20 text-[#fa233b] focus:ring-[#fa233b] focus:ring-offset-0 bg-transparent" />
                <label className="text-sm font-medium text-slate-300">Wi-Fi only</label>
              </div>
              <div className="flex items-center gap-3 bg-white/5 px-4 py-3 rounded-xl border border-white/5 opacity-50 cursor-not-allowed">
                <input type="checkbox" disabled checked={false} className="w-4 h-4 rounded border-white/20 bg-transparent cursor-not-allowed" />
                <label className="text-sm font-medium text-slate-300 cursor-not-allowed">Include videos (Online only)</label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDownload}
              className="w-full py-3.5 rounded-full bg-[#fa233b] text-white font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download {toDownloadCount > 0 ? `${toDownloadCount} Songs` : ''}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-full text-slate-400 hover:text-white font-bold text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

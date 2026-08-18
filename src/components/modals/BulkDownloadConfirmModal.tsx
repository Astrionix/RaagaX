import React, { useEffect, useState } from 'react';
import { useDownloadStore } from '@/context/useDownloadStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Download, HardDrive, AlertTriangle, CheckCircle2, Sliders, Music, ShieldCheck } from 'lucide-react';
import { Song } from '@/types/music';
import { RaagaXNativeDownload } from '@/lib/playback/native/RaagaXNativeDownload';

export function BulkDownloadConfirmModal({ 
  isOpen, 
  onClose, 
  title,
  subtitle,
  coverUrl,
  songs,
  playlistId = 'pl_custom'
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string;
  subtitle: string;
  coverUrl: string;
  songs: Song[];
  playlistId?: string;
}) {
  const { downloadPlaylist, wifiOnly, setWifiOnly, offlineSettings, setOfflineSettings } = useDownloadStore();
  const { downloadedSongIds, setToastMessage } = usePlayerStore();
  
  const [selectedQuality, setSelectedQuality] = useState<'128 kbps' | '192 kbps' | '320 kbps'>(
    (offlineSettings.audioQuality as any) || '320 kbps'
  );
  const [availableStorageBytes, setAvailableStorageBytes] = useState<number>(64 * 1024 * 1024 * 1024);
  const [isCheckingStorage, setIsCheckingStorage] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const check = async () => {
      setIsCheckingStorage(true);
      try {
        if (RaagaXNativeDownload.isNative()) {
          const res = await RaagaXNativeDownload.checkStorage(15 * 1024 * 1024);
          setAvailableStorageBytes(res.availableBytes || 0);
        } else if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          const quota = estimate.quota || 0;
          const usage = estimate.usage || 0;
          setAvailableStorageBytes(Math.max(0, quota - usage));
        }
      } catch (e) {
        console.warn('Storage check failed:', e);
      } finally {
        setIsCheckingStorage(false);
      }
    };

    check();
  }, [isOpen]);

  if (!isOpen) return null;

  const alreadyDownloadedCount = songs.filter(s => s && downloadedSongIds.includes(s.id)).length;
  const toDownloadCount = Math.max(0, songs.length - alreadyDownloadedCount);

  // Dynamic estimate based on bitrate
  // 320 kbps ~ 2.4MB/min -> ~8.5MB per 3.5min track
  // 192 kbps ~ 1.4MB/min -> ~5.2MB per 3.5min track
  // 128 kbps ~ 0.95MB/min -> ~3.4MB per 3.5min track
  const multiplierMB = selectedQuality === '320 kbps' ? 8.5 : selectedQuality === '192 kbps' ? 5.2 : 3.4;
  const estimatedTotalBytes = toDownloadCount * multiplierMB * 1024 * 1024;
  const hasSufficientSpace = availableStorageBytes >= estimatedTotalBytes;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return (val >= 10 ? val.toFixed(0) : val.toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = () => {
    if (!hasSufficientSpace) {
      setToastMessage(`Not enough storage. Required: ${formatBytes(estimatedTotalBytes)}, Available: ${formatBytes(availableStorageBytes)}`);
      return;
    }

    const toDownload = songs.filter(s => s && !downloadedSongIds.includes(s.id));
    if (toDownload.length === 0) {
      setToastMessage('All songs are already downloaded.');
      onClose();
      return;
    }

    setOfflineSettings({ audioQuality: selectedQuality });
    downloadPlaylist(toDownload, selectedQuality, title, playlistId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#14151a] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="p-6 flex flex-col gap-5">
          {/* Header Preview */}
          <div className="flex items-center gap-4">
            <img 
              src={coverUrl || '/app-icon.png'} 
              alt="Cover" 
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
              className="w-16 h-16 rounded-2xl object-cover shadow-xl border border-white/10 flex-shrink-0 bg-slate-800" 
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">
                Download to Music/RaagaX
              </span>
              <h2 className="text-base font-black text-white tracking-tight truncate">{title}</h2>
              <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                {songs.length} total tracks {alreadyDownloadedCount > 0 && `(${alreadyDownloadedCount} already offline)`}
              </p>
            </div>
          </div>

          {/* Quality Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#fa233b]" /> Select Audio Quality
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '128 kbps', label: '128 kbps', sub: 'Standard (~3.4 MB)', badge: 'Compact' },
                { id: '192 kbps', label: '192 kbps', sub: 'Medium (~5.2 MB)', badge: 'Balanced' },
                { id: '320 kbps', label: '320 kbps', sub: 'Lossless (~8.5 MB)', badge: 'Hi-Fi' },
              ].map((q) => {
                const isSelected = selectedQuality === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedQuality(q.id as any)}
                    className={`p-3 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#fa233b]/15 border-[#fa233b] text-white shadow-md shadow-red-500/20'
                        : 'bg-white/[0.03] border-white/5 text-slate-400 hover:border-white/15 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black">{q.label}</span>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#fa233b] bg-[#fa233b]' : 'border-white/20'}`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 block leading-tight">{q.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Storage & Estimation Meter */}
          <div className="bg-black/40 rounded-2xl p-4 border border-white/5 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Estimated download size</span>
              <span className="font-mono font-bold text-white text-sm">
                {formatBytes(estimatedTotalBytes)}
              </span>
            </div>
            
            <div className="h-px w-full bg-white/5" />
            
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Available device storage
              </span>
              <span className={`font-mono font-bold ${hasSufficientSpace ? 'text-emerald-400' : 'text-red-400'}`}>
                {isCheckingStorage ? 'Checking...' : formatBytes(availableStorageBytes)}
              </span>
            </div>
          </div>

          {/* Insufficient Storage Warning Alert */}
          {!hasSufficientSpace && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white text-xs">Not Enough Storage Space</p>
                <p className="text-[11px] text-red-300/90 mt-0.5">
                  Required: <span className="font-bold">{formatBytes(estimatedTotalBytes)}</span> • Available: <span className="font-bold">{formatBytes(availableStorageBytes)}</span>
                </p>
                <p className="text-[10px] text-red-400 mt-1">Free some device storage and try again.</p>
              </div>
            </div>
          )}

          {/* Preferences */}
          <div className="flex items-center justify-between bg-white/[0.03] px-4 py-3 rounded-2xl border border-white/5">
            <div>
              <p className="text-xs font-bold text-white">Wi-Fi only downloads</p>
              <p className="text-[10px] text-slate-400">Prevent downloads over cellular mobile data</p>
            </div>
            <input 
              type="checkbox" 
              checked={wifiOnly} 
              onChange={(e) => setWifiOnly(e.target.checked)} 
              className="w-4 h-4 rounded border-white/20 text-[#fa233b] focus:ring-[#fa233b] bg-transparent cursor-pointer" 
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleDownload}
              disabled={!hasSufficientSpace || toDownloadCount === 0}
              className={`w-full py-3.5 rounded-full font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                hasSufficientSpace && toDownloadCount > 0
                  ? 'bg-[#fa233b] hover:bg-[#ff3b53] text-white shadow-xl shadow-red-500/30 active:scale-95'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" /> 
              {toDownloadCount > 0 ? `Download ${toDownloadCount} Songs (${selectedQuality})` : 'All Songs Already Downloaded'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-full text-slate-400 hover:text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

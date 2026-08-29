'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Download, 
  HardDrive, 
  Play, 
  Pause,
  Trash2, 
  CheckCircle2, 
  Music, 
  PauseCircle, 
  PlayCircle, 
  XCircle,
  FileDown,
  Wifi,
  Sliders,
  Search,
  RefreshCw,
  Cloud,
  Laptop,
  Smartphone,
  Tablet,
  Tv,
  Edit2,
  Check,
  X,
  Layers,
  Database,
  Info,
  Sparkles,
  MonitorSmartphone,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { OfflineTrack, StorageEstimateInfo } from '@/lib/offline/types';
import { Song } from '@/types/music';

export function DownloadsView() {
  const { playSong, cloudDownloadRecords = [], downloadedSongIds = [] } = usePlayerStore();
  const { 
    tasks, 
    saveForOffline,
    pauseDownload, 
    resumeDownload, 
    cancelDownload, 
    retryDownload,
    removeDownload, 
    pauseAll, 
    resumeAll, 
    cancelAll,
    exportSong,
    wifiOnly,
    setWifiOnly,
    offlineSettings,
    setOfflineSettings,
    isOfflineMode,
    setOfflineMode,
    playlistDownloadProgress,
  } = useDownloadStore();

  const [activeSubTab, setActiveSubTab] = useState<'device' | 'cloud'>('device');
  const [offlineCatalogTracks, setOfflineCatalogTracks] = useState<OfflineTrack[]>([]);
  const [localSearch, setLocalSearch] = useState('');
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo | null>(null);

  const formatSpeed = (bytesPerSec?: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return 'Calculating speed...';
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${Math.round(bytesPerSec / 1024)} KB/s`;
  };

  const formatEta = (seconds?: number) => {
    if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return null;
    if (seconds < 60) return `~${Math.round(seconds)}s left`;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `~${m}:${s.toString().padStart(2, '0')} left`;
  };
  
  // Custom device name editing
  const [isEditingDeviceName, setIsEditingDeviceName] = useState(false);
  const [customDeviceInput, setCustomDeviceInput] = useState('');

  const refreshCatalog = async () => {
    try {
      const { RaagaXNativeDownload } = await import('@/lib/playback/native/RaagaXNativeDownload');
      if (RaagaXNativeDownload.isNative()) {
        const nativeTracks = await RaagaXNativeDownload.getDownloadedTracks();
        const mappedTracks: OfflineTrack[] = nativeTracks.map((t) => ({
          trackId: t.songId || t.id,
          localMediaId: t.songId || t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artworkUrl: t.artworkUrl || t.coverUrl,
          duration: 180,
          durationMs: 180000,
          mimeType: t.mimeType || 'audio/mpeg',
          quality: (t.quality as any) || '320 kbps',
          fileSizeBytes: t.fileSize,
          checksum: 'native',
          leaseExpiresAt: Date.now() + 30 * 24 * 3600 * 1000,
          downloadedAt: t.completedAt || Date.now(),
          version: '2',
          playCount: 1,
        }));
        setOfflineCatalogTracks(mappedTracks);
        const info = await useDownloadStore.getState().fetchStorageInfo();
        setStorageInfo(info);
        return;
      }

      const tracks = await OfflineCatalog.getInstance().getAllTracks();
      setOfflineCatalogTracks(tracks);
      
      const info = await DownloadStorage.getInstance().getStorageEstimate();
      setStorageInfo(info);
    } catch {}
  };

  useEffect(() => {
    refreshCatalog();
  }, [Object.keys(tasks).length, downloadedSongIds.length]);

  const handleSaveDeviceName = async () => {
    if (customDeviceInput.trim() && typeof window !== 'undefined') {
      localStorage.setItem('raagax_device_name', customDeviceInput.trim());
      await refreshCatalog();
    }
    setIsEditingDeviceName(false);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return (val >= 10 ? val.toFixed(0) : val.toFixed(1)) + ' ' + sizes[i];
  };

  const activeTasks = Object.values(tasks).filter(
    t => ['downloading', 'queued', 'paused', 'verifying', 'failed', 'error'].includes(t.status?.toLowerCase())
  );
  const downloadingTasks = activeTasks.filter(t => ['downloading', 'verifying', 'paused', 'failed', 'error'].includes(t.status?.toLowerCase()));
  const queuedTasks = activeTasks.filter(t => t.status?.toLowerCase() === 'queued');

  const nativeDownloadedTracks = useDownloadStore((s) => s.nativeDownloadedTracks);

  // Convert offline catalog and native tracks to Song objects
  const offlineSongs: Song[] = useMemo(() => {
    const songMap: Record<string, Song> = {};

    // 1. Native verified downloads
    Object.values(nativeDownloadedTracks).forEach((t) => {
      if (t && (t.songId || t.id)) {
        const id = t.songId || t.id;
        songMap[id] = {
          id,
          title: t.title || id,
          artist: t.artist || '',
          artistId: `art-${id}`,
          album: t.album || 'Music/RaagaX',
          albumId: `alb-${id}`,
          duration: 180,
          coverUrl: t.artworkUrl || t.coverUrl || '/app-icon.png',
          audioUrl: t.localPath || '',
          genre: 'OFFLINE',
          category: 'melody',
          releaseYear: new Date().getFullYear(),
          plays: 1,
          likes: 1,
        };
      }
    });

    // 2. Offline Catalog tracks (Web / PWA)
    offlineCatalogTracks.forEach((track) => {
      if (track && track.trackId && !songMap[track.trackId]) {
        songMap[track.trackId] = {
          id: track.trackId,
          title: track.title,
          artist: track.artist,
          artistId: `art-${track.trackId}`,
          album: track.album || 'Downloaded Offline',
          albumId: `alb-${track.trackId}`,
          duration: track.duration || Math.round(track.durationMs / 1000) || 180,
          coverUrl: track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
          audioUrl: '',
          genre: 'OFFLINE',
          category: 'melody',
          releaseYear: new Date().getFullYear(),
          plays: track.playCount || 1,
          likes: 1,
        };
      }
    });

    return Object.values(songMap);
  }, [offlineCatalogTracks, nativeDownloadedTracks]);

  const filteredOfflineSongs = useMemo(() => {
    if (!localSearch.trim()) return offlineSongs;
    const query = localSearch.toLowerCase();
    return offlineSongs.filter(
      (s) => s.title.toLowerCase().includes(query) || s.artist.toLowerCase().includes(query)
    );
  }, [offlineSongs, localSearch]);

  const handlePlayDownloadedSong = (song: Song) => {
    playSong(song, filteredOfflineSongs, { type: 'downloads', id: 'downloads_view', title: 'Downloaded Music' });
  };

  // Safe storage metrics
  const totalQuota = storageInfo?.quota || 64 * 1024 * 1024 * 1024;
  const raagaXDownloads = storageInfo?.raagaXDownloads || 0;
  const raagaXCache = storageInfo?.raagaXCache || 0;
  const raagaXTotal = storageInfo?.raagaXUsed || (raagaXDownloads + raagaXCache);
  const totalUsage = storageInfo?.usage || raagaXTotal;
  const freeSpace = Math.max(0, totalQuota - totalUsage);

  // Proportions for multi-segmented bar
  const raagaXDownloadsPct = totalQuota > 0 ? Math.min(100, (raagaXDownloads / totalQuota) * 100) : 0;
  const raagaXCachePct = totalQuota > 0 ? Math.min(100, (raagaXCache / totalQuota) * 100) : 0;
  const otherUsedPct = totalQuota > 0 ? Math.max(0, Math.min(100, ((totalUsage - raagaXTotal) / totalQuota) * 100)) : 0;

  // Device icon based on device type
  const renderDeviceIcon = () => {
    switch (storageInfo?.deviceType) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-sky-400" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-indigo-400" />;
      case 'tv':
        return <Tv className="w-5 h-5 text-purple-400" />;
      case 'desktop':
      default:
        return <Laptop className="w-5 h-5 text-emerald-400" />;
    }
  };

  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());

  if (!isNative) {
    return (
      <div className="space-y-6 pb-2 text-white select-none max-w-xl mx-auto pt-12 text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-xl shadow-emerald-500/10">
          <Smartphone className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">Mobile Exclusive Feature</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Offline MP3 downloads and device storage management are exclusive to the <strong className="text-white">RaagaX Mobile App</strong>.
          </p>
          <p className="text-xs text-slate-500">
            On Desktop, enjoy high-fidelity real-time streaming with zero local disk footprint.
          </p>
        </div>
        <div className="pt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => usePlayerStore.getState().setActiveTab('home')}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#fa233b] to-[#d91c2e] text-white font-bold text-xs shadow-lg shadow-red-500/25 hover:brightness-110 transition-all cursor-pointer"
          >
            Explore Music on Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-2 text-white select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => usePlayerStore.getState().setActiveTab('library')}
              className="md:hidden p-2 -ml-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Back to Library"
            >
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Downloads & Storage</h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-slate-300">
              {renderDeviceIcon()}
              {storageInfo?.platform || 'Device'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">App-private offline listening cache & device media export</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setOfflineMode(!isOfflineMode)}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-full border text-xs font-bold transition-all ${
              isOfflineMode 
                ? 'bg-[#fa233b] border-[#fa233b] text-white shadow-lg shadow-red-500/20' 
                : 'bg-[var(--bg-secondary)] border-white/10 text-slate-300 hover:border-white/20'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isOfflineMode ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
            <span>{isOfflineMode ? 'Forced Offline Mode Active' : 'Go Offline'}</span>
          </button>
        </div>
      </div>

      {/* Concept 1: Dynamic Device Storage & Quota Card */}
      <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-white/10 space-y-5 shadow-xl">
        {/* Device Registered Name Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              {renderDeviceIcon()}
            </div>
            {isEditingDeviceName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customDeviceInput}
                  onChange={(e) => setCustomDeviceInput(e.target.value)}
                  placeholder="e.g. TNT Gaming PC or Galaxy S23"
                  className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-sm rounded-lg px-2.5 py-1 focus:outline-none focus:border-red-500"
                  autoFocus
                />
                <button 
                  onClick={handleSaveDeviceName}
                  className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  title="Save device name"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsEditingDeviceName(false)}
                  className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <span className="text-base font-black text-white tracking-wide">
                  {storageInfo?.deviceName || 'Active Device'}
                </span>
                <button 
                  onClick={() => {
                    setCustomDeviceInput(storageInfo?.deviceName || '');
                    setIsEditingDeviceName(true);
                  }}
                  className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                  title="Rename this device"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 px-2.5 py-1 rounded-full bg-white/5 border border-white/5">
              {storageInfo?.isNative ? '📱 Android Native Storage' : '💻 Browser / Desktop Storage Quota'}
            </span>
          </div>
        </div>

        {/* Storage Bar & Values */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold mb-2.5">
            <span className="flex items-center gap-2 text-slate-300">
              <HardDrive className="w-4 h-4 text-[#fa233b]" /> Device Storage & Offline Cache
            </span>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-emerald-400">
                Free: <span className="font-bold">{formatBytes(freeSpace)}</span>
              </span>
              <span className="text-[#fa233b]">
                RaagaX: <span className="font-bold">{formatBytes(raagaXTotal)}</span>
              </span>
              <span className="text-slate-400">
                Total: <span className="font-bold">{formatBytes(totalQuota)}</span>
              </span>
            </div>
          </div>

          {/* Multi-segment Storage Bar */}
          <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden flex">
            {otherUsedPct > 0 && (
              <div 
                className="h-full bg-slate-600 transition-all duration-500" 
                style={{ width: `${otherUsedPct}%` }}
                title={`System & Other Apps: ${formatBytes(totalUsage - raagaXTotal)}`}
              />
            )}
            {raagaXDownloadsPct > 0 && (
              <div 
                className="h-full bg-[#fa233b] transition-all duration-500" 
                style={{ width: `${Math.max(1, raagaXDownloadsPct)}%` }}
                title={`RaagaX Downloads: ${formatBytes(raagaXDownloads)}`}
              />
            )}
            {raagaXCachePct > 0 && (
              <div 
                className="h-full bg-amber-400 transition-all duration-500" 
                style={{ width: `${Math.max(1, raagaXCachePct)}%` }}
                title={`RaagaX Cache: ${formatBytes(raagaXCache)}`}
              />
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-medium text-slate-400 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#fa233b]" /> RaagaX Downloads ({formatBytes(raagaXDownloads)})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Offline & Stream Cache ({formatBytes(raagaXCache)})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Free Space ({formatBytes(freeSpace)})
            </span>
          </div>
        </div>

        {/* Concept 2: Granular RaagaX Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold">Song Downloads</span>
              <Music className="w-4 h-4 text-[#fa233b]" />
            </div>
            <div className="mt-2">
              <p className="text-lg font-black text-white">{formatBytes(raagaXDownloads)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{offlineSongs.length} downloaded songs</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold">Offline Cache</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2">
              <p className="text-lg font-black text-white">{formatBytes(raagaXCache)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Stream buffers & artwork</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold">Total RaagaX</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <p className="text-lg font-black text-white">{formatBytes(raagaXTotal)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">App-sandboxed footprint</p>
            </div>
          </div>
        </div>

        {/* Preferences Toggle Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-2.5">
              <Wifi className="w-4 h-4 text-sky-400" />
              <div>
                <p className="font-bold text-white text-[12px]">Wi-Fi Only Downloads</p>
                <p className="text-[10px] text-slate-400">Prevent downloads over metered mobile data</p>
              </div>
            </div>
            <button
              onClick={() => setWifiOnly(!wifiOnly)}
              className={`w-9 h-5 rounded-full relative transition-colors ${wifiOnly ? 'bg-sky-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full transition-transform ${wifiOnly ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="font-bold text-white text-[12px]">Audio Quality</p>
                <p className="text-[10px] text-slate-400">Offline playback encoding</p>
              </div>
            </div>
            <select
              value={offlineSettings.audioQuality}
              onChange={(e) => setOfflineSettings({ audioQuality: e.target.value as any })}
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500 font-bold cursor-pointer transition-colors shadow-sm"
            >
              <option value="Standard" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Standard (128 kbps)</option>
              <option value="High" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">High (320 kbps)</option>
              <option value="Lossless" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Lossless (Hi-Fi)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons Bar: Clear Cache & Purge All Downloads */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> App-Private Offline Storage
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Zero Permissions Needed</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await useDownloadStore.getState().clearStreamingCache();
                await refreshCatalog();
              }}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs transition-colors flex items-center gap-2 border border-white/10 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Clear Cache</span>
            </button>
            <button
              onClick={async () => {
                await useDownloadStore.getState().purgeOfflineDownloads();
                await refreshCatalog();
              }}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition-colors flex items-center gap-2 border border-red-500/20 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge All Downloads</span>
            </button>
          </div>
        </div>
      </div>

      {/* Playlist Download Progress Banner */}
      {playlistDownloadProgress && playlistDownloadProgress.status === 'DOWNLOADING' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-600/20 via-purple-600/20 to-slate-900 border border-red-500/30 space-y-3 shadow-xl animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#fa233b] animate-pulse" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Downloading Playlist: {playlistDownloadProgress.playlistTitle}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-[#fa233b]">
              {playlistDownloadProgress.completedSongs} / {playlistDownloadProgress.totalSongs} songs
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#fa233b] to-purple-500 transition-all duration-300 rounded-full"
              style={{ width: `${playlistDownloadProgress.overallProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span className="truncate max-w-[200px]">Current: <span className="font-bold text-white">{playlistDownloadProgress.currentSongTitle}</span></span>
            <div className="flex items-center gap-2">
              <button onClick={pauseAll} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200">Pause All</button>
              <button onClick={cancelAll} className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-bold text-red-400">Cancel All</button>
            </div>
          </div>
        </div>
      )}

      {/* Active & Queued Tasks: Pause All, Resume All, Cancel All */}
      {activeTasks.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Download className="w-4 h-4 text-[#fa233b]" /> CURRENTLY DOWNLOADING ({downloadingTasks.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={pauseAll}
                className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause All</span>
              </button>
              <button
                onClick={resumeAll}
                className="text-xs font-bold text-emerald-300 hover:text-white px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume All</span>
              </button>
              <button
                onClick={cancelAll}
                className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel All</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {downloadingTasks.map((task) => {
              const isFailed = task.status === 'FAILED';
              const isPaused = task.status === 'PAUSED';
              const isVerifying = task.status === 'VERIFYING';
              const etaText = formatEta(task.etaSeconds);

              return (
                <div key={task.song.id} className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-white/10 space-y-3 shadow-lg">
                  <div className="flex items-center gap-3.5">
                    <img 
                      src={task.song.coverUrl} 
                      alt={task.song.title || 'Artwork'} 
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-md" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white truncate">{task.song.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono font-bold text-slate-400">
                            {task.quality || '320 kbps'}
                          </span>
                          <span className={`text-xs font-mono font-black ${isFailed ? 'text-red-400' : isPaused ? 'text-amber-400' : isVerifying ? 'text-indigo-400 animate-pulse' : 'text-[#fa233b]'}`}>
                            {isVerifying ? 'Verifying...' : isFailed ? 'Failed' : isPaused ? 'Paused' : `${task.progress}%`}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{task.song.artist}</p>
                    </div>
                  </div>

                  {/* Error banner if failed */}
                  {isFailed && task.error && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 flex items-center justify-between gap-2">
                      <span className="truncate">{task.error}</span>
                      <button 
                        onClick={() => retryDownload(task.song.id)} 
                        className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-[10px] flex-shrink-0 transition-all cursor-pointer"
                      >
                        Retry Now
                      </button>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {!isFailed && (
                    <div className="space-y-1.5">
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isPaused ? 'bg-amber-500' : 
                            isVerifying ? 'bg-indigo-500 animate-pulse' : 
                            'bg-gradient-to-r from-[#fa233b] to-red-400'
                          }`} 
                          style={{ width: `${Math.max(1, task.progress)}%` }} 
                        />
                      </div>

                      {/* Byte Metrics, Live Speed & ETA */}
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>
                          {formatBytes(task.downloadedBytes)} {task.totalBytes > 0 && `/ ${formatBytes(task.totalBytes)}`}
                        </span>
                        <div className="flex items-center gap-3">
                          {task.status === 'DOWNLOADING' && (
                            <span className="text-emerald-400 font-bold">
                              {formatSpeed(task.speedBytesPerSec)}
                            </span>
                          )}
                          {etaText && task.status === 'DOWNLOADING' && (
                            <span className="text-slate-500 font-medium">
                              {etaText}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* State-aware Action Controls */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                    {isFailed ? (
                      <>
                        <button 
                          onClick={() => retryDownload(task.song.id)} 
                          className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                        <button 
                          onClick={() => cancelDownload(task.song.id)} 
                          className="px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </>
                    ) : isPaused ? (
                      <>
                        <button 
                          onClick={() => resumeDownload(task.song.id)} 
                          className="px-3 py-1 rounded-xl bg-[#fa233b] hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Resume</span>
                        </button>
                        <button 
                          onClick={() => cancelDownload(task.song.id)} 
                          className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-400 text-xs font-bold transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => pauseDownload(task.song.id)} 
                          className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <PauseCircle className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>
                        <button 
                          onClick={() => cancelDownload(task.song.id)} 
                          className="px-3 py-1 rounded-xl bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-xs font-bold transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Queued Section */}
            {queuedTasks.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider px-1">
                  Queued ({queuedTasks.length})
                </h4>
                {queuedTasks.map((task, index) => (
                  <div key={task.song.id} className="p-3 rounded-2xl bg-[var(--bg-secondary)]/80 border border-white/5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-300 truncate">{task.song.title}</h4>
                        <p className="text-[10px] text-slate-500 truncate">{task.song.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[10px] text-slate-500 font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                        {downloadingTasks.length === 0 && index === 0 ? 'Starting...' : `Queued #${index + 1}`}
                      </span>
                      <button onClick={() => cancelDownload(task.song.id)} className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offline Music Catalog & Cloud Download History Section */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/5 self-start">
            <button
              onClick={() => setActiveSubTab('device')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'device'
                  ? 'bg-[#fa233b] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>On This Device</span>
            </button>
            <button
              onClick={() => setActiveSubTab('cloud')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'cloud'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloud History</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeSubTab === 'cloud' && cloudDownloadRecords.some(r => !downloadedSongIds.includes(r.song_id)) && (
              <button
                onClick={async () => {
                  const missingRecords = cloudDownloadRecords.filter(r => !downloadedSongIds.includes(r.song_id));
                  for (const r of missingRecords) {
                    const songObj: Song = {
                      id: r.song_id,
                      title: r.song_title || 'Unknown Title',
                      artist: r.song_artist || 'Unknown Artist',
                      artistId: `art-${r.song_id}`,
                      album: 'Cloud Downloads',
                      albumId: `alb-${r.song_id}`,
                      duration: r.song_duration || 180,
                      coverUrl: r.song_cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
                      audioUrl: '',
                      genre: 'OFFLINE',
                      category: 'melody',
                      releaseYear: new Date().getFullYear(),
                      plays: 1,
                      likes: 1,
                    };
                    await saveForOffline(songObj);
                  }
                  await refreshCatalog();
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Restore All Missing</span>
              </button>
            )}

            {(activeSubTab === 'device' ? offlineSongs.length > 0 : cloudDownloadRecords.length > 0) && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={activeSubTab === 'device' ? "Search downloaded songs..." : "Search cloud history..."}
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            )}
          </div>
        </div>

        {activeSubTab === 'device' ? (
          filteredOfflineSongs.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>{filteredOfflineSongs.length} downloaded songs • {formatBytes(raagaXDownloads)}</span>
              </div>

              <div className="divide-y divide-white/5 bg-[var(--bg-secondary)] rounded-2xl border border-white/10 overflow-hidden shadow-lg">
                {filteredOfflineSongs.map((song) => (
                  <div key={song.id} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-3.5 cursor-pointer min-w-0 flex-1" onClick={() => handlePlayDownloadedSong(song)}>
                      <img src={song.coverUrl} alt={song.title} className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">{song.title}</h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Mode B: Export as MP3 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportSong(song);
                        }}
                        title="Export MP3 to device storage (Mode B)"
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handlePlayDownloadedSong(song)}
                        className="p-2 rounded-xl bg-[#fa233b] text-white shadow-md hover:scale-105 transition-transform"
                        title="Play Offline"
                      >
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      </button>

                      <button 
                        onClick={async () => {
                          await removeDownload(song.id);
                          await refreshCatalog();
                        }} 
                        className="p-2 text-slate-400 hover:text-red-400"
                        title="Delete from Device"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTasks.length > 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-2 bg-[var(--bg-secondary)] rounded-2xl border border-white/10">
              <Download className="w-8 h-8 text-[#fa233b] mx-auto animate-pulse opacity-80" />
              <p className="text-xs font-bold text-slate-300">Downloading your tracks...</p>
              <p className="text-[11px] text-slate-500">Your songs will appear here automatically as soon as the download completes.</p>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 space-y-3 bg-[var(--bg-secondary)] rounded-2xl border border-white/10">
              <HardDrive className="w-10 h-10 text-slate-600 mx-auto opacity-60" />
              <div>
                <p className="text-sm font-bold text-slate-400">No songs currently stored on this device</p>
                <p className="text-xs text-slate-500 mt-1">
                  {cloudDownloadRecords.length > 0 
                    ? `You have ${cloudDownloadRecords.length} songs in Cloud History. Switch to Cloud History tab to download them.`
                    : 'Tap the download icon on any song to save it for offline listening.'}
                </p>
              </div>
            </div>
          )
        ) : (
          /* Cloud Download History Tab */
          cloudDownloadRecords.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>{cloudDownloadRecords.length} songs recorded in Cloud History • 1-click restore across devices</span>
              </div>

              <div className="divide-y divide-white/5 bg-[var(--bg-secondary)] rounded-2xl border border-white/10 overflow-hidden shadow-lg">
                {cloudDownloadRecords
                  .filter(r => !localSearch.trim() || (r.song_title?.toLowerCase().includes(localSearch.toLowerCase()) || r.song_artist?.toLowerCase().includes(localSearch.toLowerCase())))
                  .map((record) => {
                    const isLocal = downloadedSongIds.includes(record.song_id);
                    const songObj: Song = {
                      id: record.song_id,
                      title: record.song_title || 'Unknown Title',
                      artist: record.song_artist || 'Unknown Artist',
                      artistId: `art-${record.song_id}`,
                      album: 'Cloud Downloads',
                      albumId: `alb-${record.song_id}`,
                      duration: record.song_duration || 180,
                      coverUrl: record.song_cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
                      audioUrl: '',
                      genre: 'OFFLINE',
                      category: 'melody',
                      releaseYear: new Date().getFullYear(),
                      plays: 1,
                      likes: 1,
                    };

                    return (
                      <div key={record.song_id} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <img src={songObj.coverUrl} alt={songObj.title} className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-white truncate">{songObj.title}</h4>
                              {isLocal ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                                  On Device ✓
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[9px] font-bold border border-sky-500/20">
                                  Cloud Only
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{songObj.artist}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isLocal ? (
                            <button
                              onClick={async () => {
                                await removeDownload(record.song_id);
                                await refreshCatalog();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-xs font-bold flex items-center gap-1.5 transition-all"
                              title="Remove from this device only"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Local</span>
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                await saveForOffline(songObj);
                                await refreshCatalog();
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all hover:scale-105"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Again ↓</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 space-y-3 bg-[var(--bg-secondary)] rounded-2xl border border-white/10">
              <Cloud className="w-10 h-10 text-slate-600 mx-auto opacity-60" />
              <div>
                <p className="text-sm font-bold text-slate-400">No cloud download history found</p>
                <p className="text-xs text-slate-500 mt-1">When you download songs, your account metadata is synced to allow 1-click restore across devices.</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

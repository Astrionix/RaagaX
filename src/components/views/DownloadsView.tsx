'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Download, 
  HardDrive, 
  Play, 
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
  Cloud
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { OfflineTrack } from '@/lib/offline/types';
import { Song } from '@/types/music';

export function DownloadsView() {
  const { playSong, cloudDownloadRecords = [], downloadedSongIds = [] } = usePlayerStore();
  const { 
    tasks, 
    saveForOffline,
    pauseDownload, 
    resumeDownload, 
    cancelDownload, 
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
  } = useDownloadStore();

  const [activeSubTab, setActiveSubTab] = useState<'device' | 'cloud'>('device');
  const [offlineCatalogTracks, setOfflineCatalogTracks] = useState<OfflineTrack[]>([]);
  const [localSearch, setLocalSearch] = useState('');
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 64 * 1024 * 1024 * 1024 });

  const refreshCatalog = async () => {
    try {
      const tracks = await OfflineCatalog.getInstance().getAllTracks();
      setOfflineCatalogTracks(tracks);
      
      const usedBytes = await DownloadStorage.getInstance().getTotalStorageUsed();
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setStorageUsage({
          used: usedBytes || estimate.usage || 0,
          total: estimate.quota || 64 * 1024 * 1024 * 1024,
        });
      } else {
        setStorageUsage({
          used: usedBytes,
          total: 64 * 1024 * 1024 * 1024,
        });
      }
    } catch {}
  };

  useEffect(() => {
    refreshCatalog();
  }, [Object.keys(tasks).length]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const usedPercent = Math.min(100, (storageUsage.used / storageUsage.total) * 100);

  const activeTasks = Object.values(tasks).filter(
    t => t.status === 'downloading' || t.status === 'queued' || t.status === 'paused' || t.status === 'verifying' || t.status === 'error'
  );
  const downloadingTasks = activeTasks.filter(t => t.status === 'downloading' || t.status === 'verifying' || t.status === 'paused' || t.status === 'error');
  const queuedTasks = activeTasks.filter(t => t.status === 'queued');

  // Convert offline catalog tracks to Song objects
  const offlineSongs: Song[] = useMemo(() => {
    return offlineCatalogTracks.map((track) => ({
      id: track.trackId,
      title: track.title,
      artist: track.artist,
      artistId: `art-${track.trackId}`,
      album: track.album || 'Downloaded Offline',
      albumId: `alb-${track.trackId}`,
      duration: track.duration || Math.round(track.durationMs / 1000) || 180,
      coverUrl: track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
      audioUrl: '', // PlaybackSourceResolver will supply the local Blob URL
      genre: 'OFFLINE',
      category: 'melody',
      releaseYear: new Date().getFullYear(),
      plays: track.playCount || 1,
      likes: 1,
    }));
  }, [offlineCatalogTracks]);

  const filteredOfflineSongs = useMemo(() => {
    if (!localSearch.trim()) return offlineSongs;
    const query = localSearch.toLowerCase();
    return offlineSongs.filter(
      (s) => s.title.toLowerCase().includes(query) || s.artist.toLowerCase().includes(query)
    );
  }, [offlineSongs, localSearch]);

  const handlePlayDownloadedSong = (song: Song) => {
    playSong(song, filteredOfflineSongs);
  };

  return (
    <div className="space-y-6 pb-12 text-white select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Downloads & Storage</h1>
          <p className="text-xs text-slate-400 mt-1">App-private offline listening cache & device media export</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setOfflineMode(!isOfflineMode)}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-full border text-xs font-bold transition-all ${
              isOfflineMode 
                ? 'bg-[#fa233b] border-[#fa233b] text-white shadow-lg shadow-red-500/20' 
                : 'bg-[#161618] border-white/10 text-slate-300 hover:border-white/20'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isOfflineMode ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
            <span>{isOfflineMode ? 'Forced Offline Mode Active' : 'Go Offline'}</span>
          </button>
        </div>
      </div>

      {/* Storage & Preferences Card */}
      <div className="p-5 rounded-2xl bg-[#161618] border border-white/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold">
          <span className="flex items-center gap-2 text-slate-200">
            <HardDrive className="w-4 h-4 text-[#fa233b]" /> Device Storage & Offline Cache
          </span>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-emerald-400">
              Free: <span className="font-bold">{formatBytes(Math.max(0, storageUsage.total - storageUsage.used))}</span>
            </span>
            <span className="text-[#fa233b]">
              RaagaX: <span className="font-bold">{formatBytes(storageUsage.used)}</span>
            </span>
            <span className="text-slate-500">
              Total: {formatBytes(storageUsage.total)}
            </span>
          </div>
        </div>

        <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-red-500 via-[#fa233b] to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${Math.max(1, usedPercent)}%` }} />
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
              className="bg-[#202024] border border-white/10 text-white text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-red-500"
            >
              <option value="Standard">Standard (128 kbps)</option>
              <option value="High">High (320 kbps)</option>
              <option value="Lossless">Lossless (Hi-Fi)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px]">
            <CheckCircle2 className="w-4 h-4" /> App-Private Offline Storage • Zero Permissions Needed
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => useDownloadStore.getState().clearStreamingCache()}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-[11px] transition-colors"
            >
              Clear Cache
            </button>
            <button
              onClick={async () => {
                await useDownloadStore.getState().purgeOfflineDownloads();
                await refreshCatalog();
              }}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-[11px] transition-colors"
            >
              Purge All Downloads
            </button>
          </div>
        </div>
      </div>

      {/* Active & Queued Tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Download className="w-4 h-4 text-[#fa233b]" /> Download Queue ({activeTasks.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={pauseAll} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded bg-white/5 hover:bg-white/10">Pause All</button>
              <button onClick={resumeAll} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded bg-white/5 hover:bg-white/10">Resume All</button>
              <button onClick={cancelAll} className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 px-2.5 py-1 rounded bg-red-400/10 hover:bg-red-400/20">Cancel All</button>
            </div>
          </div>

          <div className="space-y-2">
            {downloadingTasks.map((task) => (
              <div key={task.song.id} className="p-4 rounded-xl bg-[#161618] border border-white/10 flex items-center gap-4">
                <img src={task.song.coverUrl} alt={task.song.title || 'Artwork'} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold truncate">{task.song.title}</h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      {task.status === 'verifying' ? 'Verifying checksum...' : task.status === 'error' ? 'Failed' : task.status === 'paused' ? 'Paused' : `${task.progress}%`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{task.song.artist}</p>
                  
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          task.status === 'error' ? 'bg-red-500' : 
                          task.status === 'paused' ? 'bg-amber-500' : 
                          task.status === 'verifying' ? 'bg-indigo-500 animate-pulse' : 
                          'bg-[#fa233b]'
                        }`} 
                        style={{ width: `${task.progress}%` }} 
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>{formatBytes(task.downloadedBytes)} {task.totalBytes > 0 && `/ ${formatBytes(task.totalBytes)}`}</span>
                    {task.speedBytesPerSec && task.speedBytesPerSec > 0 && (
                      <span>{formatBytes(task.speedBytesPerSec)}/s</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {task.status === 'paused' || task.status === 'error' ? (
                     <button onClick={() => resumeDownload(task.song.id)} className="p-2 text-slate-400 hover:text-white" title="Resume"><PlayCircle className="w-5 h-5" /></button>
                  ) : (
                     <button onClick={() => pauseDownload(task.song.id)} className="p-2 text-slate-400 hover:text-white" title="Pause"><PauseCircle className="w-5 h-5" /></button>
                  )}
                  <button onClick={() => cancelDownload(task.song.id)} className="p-2 text-slate-400 hover:text-red-400" title="Cancel"><XCircle className="w-5 h-5" /></button>
                </div>
              </div>
            ))}

            {queuedTasks.map((task) => (
              <div key={task.song.id} className="p-3 rounded-xl bg-[#1a1a1d] border border-white/5 flex items-center gap-4 opacity-70">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                   <h4 className="text-xs font-bold text-slate-300 truncate">{task.song.title}</h4>
                   <span className="text-[10px] text-slate-500 font-mono">Waiting in queue...</span>
                </div>
                <button onClick={() => cancelDownload(task.song.id)} className="p-1.5 text-slate-500 hover:text-red-400"><XCircle className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offline Music Catalog & Cloud Download History Section */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/5 self-start">
            <button
              onClick={() => setActiveSubTab('device')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'device'
                  ? 'bg-[#fa233b] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>On This Device ({filteredOfflineSongs.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('cloud')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'cloud'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloud History ({cloudDownloadRecords.length})</span>
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
                  className="w-full bg-[#161618] border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            )}
          </div>
        </div>

        {activeSubTab === 'device' ? (
          filteredOfflineSongs.length > 0 ? (
            <div className="divide-y divide-white/5 bg-[#161618] rounded-2xl border border-white/10 overflow-hidden shadow-lg">
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
                      title="Export MP3 to device (Mode B)"
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
          ) : (
            <div className="py-12 text-center text-slate-500 space-y-3 bg-[#161618] rounded-2xl border border-white/10">
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
            <div className="divide-y divide-white/5 bg-[#161618] rounded-2xl border border-white/10 overflow-hidden shadow-lg">
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
          ) : (
            <div className="py-12 text-center text-slate-500 space-y-3 bg-[#161618] rounded-2xl border border-white/10">
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


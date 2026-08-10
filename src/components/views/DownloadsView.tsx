'use client';

import React, { useEffect, useState } from 'react';
import { Download, HardDrive, Play, Trash2, CheckCircle2, Music, PauseCircle, PlayCircle, XCircle } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';

export function DownloadsView() {
  const { queue, downloadedSongIds, playSong } = usePlayerStore();
  const downloadedSongs = queue.filter((s) => s && s.id && downloadedSongIds.includes(s.id));
  
  const { tasks, pauseDownload, resumeDownload, cancelDownload, removeDownload, pauseAll, resumeAll, cancelAll } = useDownloadStore();

  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 64 * 1024 * 1024 * 1024 });

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        setStorageUsage({
          used: estimate.usage || 0,
          total: estimate.quota || 64 * 1024 * 1024 * 1024,
        });
      });
    }
  }, [downloadedSongIds.length]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const usedPercent = Math.min(100, (storageUsage.used / storageUsage.total) * 100);

  const activeTasks = Object.values(tasks).filter(t => t.status === 'downloading' || t.status === 'queued' || t.status === 'paused' || t.status === 'error');
  const downloadingTasks = activeTasks.filter(t => t.status === 'downloading' || t.status === 'paused' || t.status === 'error');
  const queuedTasks = activeTasks.filter(t => t.status === 'queued');

  const { isOfflineMode, setOfflineMode, setSetupModalOpen } = useDownloadStore();

  return (
    <div className="space-y-6 pb-8 text-white select-none">
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-3xl font-black text-white tracking-tight">Downloads & Storage</h1>
        <div className="flex items-center gap-3 bg-[#161618] p-1.5 rounded-full border border-white/10 pr-4 pl-1">
          <button 
            onClick={() => setOfflineMode(!isOfflineMode)}
            className={`w-10 h-6 rounded-full relative transition-colors ${isOfflineMode ? 'bg-[#fa233b]' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-transform ${isOfflineMode ? 'left-[22px]' : 'left-1'}`} />
          </button>
          <span className="text-xs font-bold text-slate-300">Offline Mode</span>
        </div>
      </div>

      {/* Storage Indicator */}
      <div className="p-5 rounded-2xl bg-[#161618] border border-white/10 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-2 text-slate-300">
            <HardDrive className="w-4 h-4 text-[#fa233b]" /> Local Device Storage Used
          </span>
          <span className="text-[#fa233b]">
            {formatBytes(storageUsage.used)} <span className="text-slate-500 font-normal">/ {formatBytes(storageUsage.total)} available</span>
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-[#fa233b] rounded-full transition-all duration-500" style={{ width: `${Math.max(1, usedPercent)}%` }} />
        </div>
        <p className="text-[10px] text-slate-500">
          Downloads are saved directly to your device's browser storage. No cloud limits apply.
        </p>
      </div>

      {activeTasks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Download className="w-4 h-4 text-[#fa233b]" /> Active Downloads ({activeTasks.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={pauseAll} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10">Pause All</button>
              <button onClick={resumeAll} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10">Resume All</button>
              <button onClick={cancelAll} className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-400/10 hover:bg-red-400/20">Cancel All</button>
            </div>
          </div>

          <div className="space-y-2">
            {downloadingTasks.map((task) => (
              <div key={task.song.id} className="p-4 rounded-xl bg-[#161618] border border-white/10 flex items-center gap-4">
                <img src={task.song.coverUrl} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold truncate">{task.song.title}</h4>
                  <p className="text-xs text-slate-400 truncate">{task.song.artist}</p>
                  
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${task.status === 'error' ? 'bg-red-500' : task.status === 'paused' ? 'bg-amber-500' : 'bg-[#fa233b]'}`} style={{ width: `${task.progress}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 w-16 text-right">
                      {task.status === 'error' ? 'Error' : task.status === 'paused' ? 'Paused' : `${task.progress}%`}
                    </span>
                  </div>
                  {task.totalBytes > 0 && (
                    <p className="text-[9px] text-slate-500 mt-1">
                      {formatBytes(task.downloadedBytes)} / {formatBytes(task.totalBytes)}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {task.status === 'paused' || task.status === 'error' ? (
                     <button onClick={() => resumeDownload(task.song.id)} className="p-2 text-slate-400 hover:text-white"><PlayCircle className="w-5 h-5" /></button>
                  ) : (
                     <button onClick={() => pauseDownload(task.song.id)} className="p-2 text-slate-400 hover:text-white"><PauseCircle className="w-5 h-5" /></button>
                  )}
                  <button onClick={() => cancelDownload(task.song.id)} className="p-2 text-slate-400 hover:text-red-400"><XCircle className="w-5 h-5" /></button>
                </div>
              </div>
            ))}

            {queuedTasks.map((task) => (
              <div key={task.song.id} className="p-3 rounded-xl bg-[#1a1a1d] border border-white/5 flex items-center gap-4 opacity-70">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                   <h4 className="text-xs font-bold text-slate-300 truncate">{task.song.title}</h4>
                   <span className="text-[10px] text-slate-500">Waiting in queue...</span>
                </div>
                <button onClick={() => cancelDownload(task.song.id)} className="p-1.5 text-slate-500 hover:text-red-400"><XCircle className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Downloads */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Downloaded Offline ({downloadedSongs.length})
        </h3>

        {downloadedSongs.length > 0 ? (
          <div className="divide-y divide-white/5 bg-[#161618] rounded-2xl border border-white/10 overflow-hidden">
            {downloadedSongs.map((song) => (
              <div key={song.id} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3.5 cursor-pointer min-w-0" onClick={() => playSong(song, downloadedSongs)}>
                  <img src={song.coverUrl} alt={song.title} className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{song.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => playSong(song, downloadedSongs)}
                    className="p-2 rounded-xl bg-[#fa233b] text-white shadow-md hover:scale-105 transition-transform"
                  >
                    <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                  </button>
                  <button onClick={() => removeDownload(song.id)} className="p-2 text-slate-400 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 space-y-2 bg-[#161618] rounded-2xl border border-white/10">
            <Music className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold">No songs downloaded offline yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

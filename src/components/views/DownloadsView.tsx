'use client';

import React from 'react';
import { Download, HardDrive, Play, Trash2, CheckCircle2, Music } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function DownloadsView() {
  const { queue, downloadedSongIds, toggleDownloadSong, playSong } = usePlayerStore();
  const downloadedSongs = queue.filter((s) => downloadedSongIds.includes(s.id));

  return (
    <div className="space-y-6 pb-8 text-white select-none">
      {/* Header */}
      <h1 className="text-3xl font-black text-white tracking-tight pt-1">Downloads & Storage</h1>

      {/* Storage Indicator Box */}
      <div className="p-5 rounded-2xl bg-[#161618] border border-white/10 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-2 text-slate-300">
            <HardDrive className="w-4 h-4 text-[#EF233C]" /> Offline Audio Storage
          </span>
          <span className="text-[#EF233C]">{downloadedSongs.length * 12} MB / 64 GB</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-[#EF233C] rounded-full" style={{ width: `${Math.min(100, downloadedSongs.length * 2)}%` }} />
        </div>
        <p className="text-[10px] text-slate-400 font-medium">320kbps Lossless MP3 Offline Audio Cache</p>
      </div>

      {/* Downloaded Songs List */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Downloaded Songs ({downloadedSongs.length})
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
                    className="p-2 rounded-xl bg-[#EF233C] text-white shadow-md hover:scale-105 transition-transform"
                  >
                    <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                  </button>
                  <button onClick={() => toggleDownloadSong(song.id)} className="p-2 text-slate-400 hover:text-red-400">
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

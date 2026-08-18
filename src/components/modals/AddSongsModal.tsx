'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, Search, Plus, Check, Music, Heart, Download, Clock, CheckCircle2, Loader2 
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore, UserPlaylist } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { Song } from '@/types/music';

interface AddSongsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: UserPlaylist;
}

export function AddSongsModal({ isOpen, onClose, playlist }: AddSongsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'favorites' | 'downloaded' | 'history'>('all');
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const { 
    likedSongs = [], 
    queue = [], 
    historySongIds = [], 
    downloadedSongIds = [],
    setToastMessage 
  } = usePlayerStore();
  const { addSongToPlaylist } = usePlaylistStore();

  // Combine known songs from queue, liked songs, etc.
  const allAvailableSongs = useMemo(() => {
    const map = new Map<string, Song>();
    likedSongs.forEach((s) => { if (s?.id) map.set(s.id, s); });
    queue.forEach((s) => { if (s?.id) map.set(s.id, s); });
    return Array.from(map.values());
  }, [likedSongs, queue]);

  const filteredSongs = useMemo(() => {
    let list = allAvailableSongs;

    if (selectedFilter === 'favorites') {
      list = likedSongs;
    } else if (selectedFilter === 'downloaded') {
      list = list.filter((s) => downloadedSongIds.includes(s.id));
    } else if (selectedFilter === 'history') {
      list = list.filter((s) => historySongIds.includes(s.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => 
        s.title.toLowerCase().includes(q) || 
        s.artist.toLowerCase().includes(q) ||
        (s.album && s.album.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allAvailableSongs, likedSongs, downloadedSongIds, historySongIds, selectedFilter, searchQuery]);

  if (!isOpen || !playlist) return null;

  const toggleSelect = (songId: string) => {
    if (playlist.songIds.includes(songId)) return; // Already in playlist
    setSelectedToAdd((prev) => 
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  const handleAddSelected = async () => {
    if (selectedToAdd.length === 0 || isAdding) return;
    setIsAdding(true);

    try {
      const songsToAdd = allAvailableSongs.filter((s) => selectedToAdd.includes(s.id));
      for (const song of songsToAdd) {
        await addSongToPlaylist(playlist.id, song);
      }
      setToastMessage(`Added ${selectedToAdd.length} ${selectedToAdd.length === 1 ? 'song' : 'songs'} to "${playlist.title}"`);
      setSelectedToAdd([]);
      onClose();
    } catch (e) {
      console.error('[AddSongsModal] Error adding songs:', e);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isAdding) onClose();
      }}
    >
      <div 
        className="bg-[#12131A] border border-white/12 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-[0_25px_60px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200 relative overflow-hidden text-white flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Add Songs</h2>
            <p className="text-xs text-slate-400 mt-0.5">Add to "{playlist.title}"</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            disabled={isAdding}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative my-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by song, artist, or album..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#08090E] text-xs text-white placeholder:text-slate-500 border border-white/15 focus:border-[#fa233b] focus:outline-none transition-all font-medium"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Songs', icon: Music },
            { id: 'favorites', label: 'Favorites', icon: Heart },
            { id: 'downloaded', label: 'Downloaded', icon: Download },
            { id: 'history', label: 'Recent', icon: Clock },
          ].map((f) => {
            const Icon = f.icon;
            const isSelected = selectedFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#fa233b] text-white shadow-sm shadow-red-500/25'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <Icon className="w-3 h-3" />
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Songs List */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5 min-h-[220px]">
          {filteredSongs.length > 0 ? (
            filteredSongs.map((song) => {
              const isAlreadyIn = playlist.songIds.includes(song.id);
              const isSelected = selectedToAdd.includes(song.id);

              return (
                <div
                  key={song.id}
                  onClick={() => toggleSelect(song.id)}
                  className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isAlreadyIn 
                      ? 'bg-white/[0.01] border-white/5 opacity-50 cursor-not-allowed'
                      : isSelected 
                      ? 'bg-[#fa233b]/10 border-[#fa233b]/40 shadow-sm' 
                      : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img 
                      src={song.coverUrl || '/app-icon.png'} 
                      alt={song.title}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                      className="w-10 h-10 rounded-xl object-cover bg-slate-800 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-[#fa233b]' : 'text-white'}`}>
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {isAlreadyIn ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
                        <Check className="w-3 h-3 stroke-[3]" /> Added
                      </span>
                    ) : isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-[#fa233b] text-white flex items-center justify-center shadow">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-white/20 hover:border-white flex items-center justify-center text-slate-400">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
              <Music className="w-8 h-8 mb-2 opacity-40 text-slate-500" />
              <p className="text-xs font-bold text-white">No songs found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Try searching or listen to music first to populate your library.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10">
          <span className="text-xs font-bold text-slate-400 font-mono">
            {selectedToAdd.length} selected
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isAdding}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={selectedToAdd.length === 0 || isAdding}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#fa233b] hover:bg-[#d91e32] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-red-500/25 flex items-center gap-1.5 cursor-pointer"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add {selectedToAdd.length > 0 ? `${selectedToAdd.length} Songs` : 'Songs'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

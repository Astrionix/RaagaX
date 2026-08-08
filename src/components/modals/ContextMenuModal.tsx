'use client';

import React from 'react';
import { X, Play, ListPlus, Heart, Download, Share2, User, Disc } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function ContextMenuModal() {
  const {
    contextMenuSong,
    closeContextMenu,
    playSong,
    playNextInQueue,
    likedSongIds,
    toggleLikeSong,
    downloadedSongIds,
    toggleDownloadSong,
    setSelectedArtistId,
    setSelectedAlbumId,
  } = usePlayerStore();

  if (!contextMenuSong) return null;

  const isLiked = likedSongIds.includes(contextMenuSong.id);
  const isDownloaded = downloadedSongIds.includes(contextMenuSong.id);

  const handlePlayNext = () => {
    playNextInQueue(contextMenuSong);
    closeContextMenu();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: contextMenuSong.title,
        text: `Listen to ${contextMenuSong.title} by ${contextMenuSong.artist} on RaagaX!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
    closeContextMenu();
  };

  return (
    <div
      onClick={closeContextMenu}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#1C1C1E] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 space-y-4 text-white shadow-2xl animate-in slide-in-from-bottom duration-300"
      >
        {/* Track Header Header */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <img
            src={contextMenuSong.coverUrl}
            alt={contextMenuSong.title}
            className="w-12 h-12 rounded-xl object-cover shadow-md"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{contextMenuSong.title}</h3>
            <p className="text-xs text-slate-400 truncate">{contextMenuSong.artist}</p>
          </div>
          <button
            onClick={closeContextMenu}
            className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Context Actions */}
        <div className="space-y-1 text-sm font-semibold">
          <button
            onClick={() => {
              playSong(contextMenuSong);
              closeContextMenu();
            }}
            className="w-full py-3 px-4 rounded-2xl hover:bg-white/10 flex items-center gap-3.5 transition-colors text-white"
          >
            <Play className="w-5 h-5 text-[#EF233C]" /> Play Now
          </button>

          <button
            onClick={handlePlayNext}
            className="w-full py-3 px-4 rounded-2xl hover:bg-white/10 flex items-center gap-3.5 transition-colors text-white"
          >
            <ListPlus className="w-5 h-5 text-slate-300" /> Play Next
          </button>

          <button
            onClick={() => {
              toggleLikeSong(contextMenuSong.id);
              closeContextMenu();
            }}
            className="w-full py-3 px-4 rounded-2xl hover:bg-white/10 flex items-center gap-3.5 transition-colors text-white"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'text-[#EF233C] fill-[#EF233C]' : 'text-slate-300'}`} />
            {isLiked ? 'Remove from Favorites' : 'Add to Favorites'}
          </button>

          <button
            onClick={() => {
              toggleDownloadSong(contextMenuSong.id);
              closeContextMenu();
            }}
            className="w-full py-3 px-4 rounded-2xl hover:bg-white/10 flex items-center gap-3.5 transition-colors text-white"
          >
            <Download className={`w-5 h-5 ${isDownloaded ? 'text-emerald-400' : 'text-slate-300'}`} />
            {isDownloaded ? 'Downloaded (320kbps MP3)' : 'Download Local File'}
          </button>

          <button
            onClick={() => {
              setSelectedArtistId(contextMenuSong.artist);
              closeContextMenu();
            }}
            className="w-full py-3 px-4 rounded-2xl hover:bg-white/10 flex items-center gap-3.5 transition-colors text-white"
          >
            <User className="w-5 h-5 text-slate-300" /> Go to Artist
          </button>

          <button
            onClick={() => {
              setSelectedAlbumId(contextMenuSong.album);
              closeContextMenu();
            }}
            className="w-full py-3 px-4 rounded-2xl hover:bg-white/10 flex items-center gap-3.5 transition-colors text-white"
          >
            <Disc className="w-5 h-5 text-slate-300" /> Go to Album
          </button>

          <button
            onClick={handleShare}
            className="w-full py-3 px-4 rounded-2xl hover:bg-white/10 flex items-center gap-3.5 transition-colors text-white"
          >
            <Share2 className="w-5 h-5 text-slate-300" /> Share Song
          </button>
        </div>
      </div>
    </div>
  );
}

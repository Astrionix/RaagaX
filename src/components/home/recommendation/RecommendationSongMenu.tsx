'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Play, ListPlus, FastForward, Heart, User, Disc, Ban, X, CheckCircle,
} from 'lucide-react';
import { Song } from '@/types/music';
import { FeedbackSignal } from '@/types/recommendation';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';

interface RecommendationSongMenuProps {
  song: Song;
  isOpen: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onFeedback: (signal: FeedbackSignal, song: Song) => void;
}

export function RecommendationSongMenu({
  song,
  isOpen,
  anchorRect,
  onClose,
  onFeedback,
}: RecommendationSongMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [subView, setSubView] = useState<'main' | 'playlist'>('main');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const {
    playSong,
    addToQueue,
    playNextInQueue,
    toggleLikeSong,
    likedSongIds,
    setSelectedArtistId,
    setSelectedAlbumId,
    setActiveTab,
    setToastMessage,
    queue,
  } = usePlayerStore();

  const { playlists, addSongToPlaylist } = usePlaylistStore();

  const isLiked = likedSongIds.includes(song?.id);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!isOpen) setSubView('main');
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-rec-menu]')) onClose();
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || !anchorRect) return null;

  // Position the menu near the anchor element, fitting within viewport
  const menuW = 220;
  const menuH = subView === 'playlist' ? 280 : 320;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchorRect.right + 4;
  if (left + menuW > vw - 8) left = anchorRect.left - menuW - 4;
  left = Math.max(8, left);

  let top = anchorRect.top;
  if (top + menuH > vh - 8) top = vh - menuH - 8;
  top = Math.max(8, top);

  const handlePlay = () => {
    const rawSongs = queue.length > 0 ? queue : [song];
    playSong(song, rawSongs.length > 0 ? rawSongs : [song]);
    onFeedback('play', song);
    onClose();
  };

  const handleAddToQueue = () => {
    addToQueue(song);
    onFeedback('add_to_queue', song);
    setToastMessage?.(`"${song.title}" added to queue`);
    onClose();
  };

  const handlePlayNext = () => {
    playNextInQueue(song);
    setToastMessage?.(`"${song.title}" plays next`);
    onClose();
  };

  const handleLike = () => {
    toggleLikeSong(song.id);
    onFeedback(isLiked ? 'unlike' : 'like', song);
    onClose();
  };

  const handleNotInterested = () => {
    onFeedback('not_interested', song);
    onClose();
  };

  const handleGoToArtist = () => {
    if (song.artistId) {
      setSelectedArtistId(song.artistId);
      setActiveTab('artist');
    }
    onClose();
  };

  const handleGoToAlbum = () => {
    if (song.albumId) {
      setSelectedAlbumId(song.albumId);
      setActiveTab('album');
    }
    onClose();
  };

  const handleAddToPlaylist = (playlistId: string, playlistTitle: string) => {
    addSongToPlaylist(playlistId, song);
    onFeedback('add_to_playlist', song);
    setToastMessage?.(`Added to "${playlistTitle}"`);
    onClose();
  };

  const menuItemCls =
    'flex items-center gap-3 px-3 py-2 text-[13px] text-slate-200 hover:bg-white/8 hover:text-white rounded-lg transition-colors cursor-pointer w-full text-left';

  const mainMenu = (
    <>
      <button className={menuItemCls} onClick={handlePlay}>
        <Play className="w-4 h-4 text-[#E50914] flex-shrink-0" />
        Play
      </button>
      <button className={menuItemCls} onClick={handlePlayNext}>
        <FastForward className="w-4 h-4 text-slate-400 flex-shrink-0" />
        Play Next
      </button>
      <button className={menuItemCls} onClick={handleAddToQueue}>
        <ListPlus className="w-4 h-4 text-slate-400 flex-shrink-0" />
        Add to Queue
      </button>

      <div className="h-px bg-white/8 my-1" />

      <button className={menuItemCls} onClick={() => setSubView('playlist')}>
        <Disc className="w-4 h-4 text-slate-400 flex-shrink-0" />
        Add to Playlist
      </button>

      <button className={menuItemCls} onClick={handleLike}>
        <Heart
          className={`w-4 h-4 flex-shrink-0 ${isLiked ? 'fill-[#E50914] text-[#E50914]' : 'text-slate-400'}`}
        />
        {isLiked ? 'Unlike' : 'Like'}
      </button>

      <div className="h-px bg-white/8 my-1" />

      <button className={menuItemCls} onClick={handleGoToArtist}>
        <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
        Go to Artist
      </button>
      <button className={menuItemCls} onClick={handleGoToAlbum}>
        <Disc className="w-4 h-4 text-slate-400 flex-shrink-0" />
        Go to Album
      </button>

      <div className="h-px bg-white/8 my-1" />

      <button
        className={`${menuItemCls} text-slate-500 hover:text-red-400`}
        onClick={handleNotInterested}
      >
        <Ban className="w-4 h-4 flex-shrink-0" />
        Not Interested
      </button>
    </>
  );

  const playlistMenu = (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8 mb-1">
        <button
          className="p-1 rounded hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
          onClick={() => setSubView('main')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <span className="text-[12px] font-semibold text-white">Add to Playlist</span>
      </div>
      {playlists.length === 0 ? (
        <p className="px-3 py-2 text-[12px] text-slate-500">No playlists yet</p>
      ) : (
        <div className="max-h-[200px] overflow-y-auto">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              className={menuItemCls}
              onClick={() => handleAddToPlaylist(pl.id, pl.title)}
            >
              <CheckCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="truncate">{pl.title}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  return createPortal(
    <div
      data-rec-menu
      style={{ position: 'fixed', top, left, width: menuW, zIndex: 9999 }}
      className="bg-[#151821] border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-1.5 animate-in fade-in zoom-in-95 duration-150 origin-top-right"
    >
      {subView === 'main' ? mainMenu : playlistMenu}
    </div>,
    document.body
  );
}

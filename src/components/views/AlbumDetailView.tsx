'use client';

import React, { useEffect, useState } from 'react';
import { Play, Heart, ArrowLeft, Shuffle, Music, Clock, Disc } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { AlbumCatalogEngine, AlbumItem } from '@/lib/albumCatalog';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { BulkDownloadConfirmModal } from '@/components/modals/BulkDownloadConfirmModal';
import { Download } from 'lucide-react';

export function AlbumDetailView() {
  const { 
    selectedAlbumId, 
    setSelectedAlbumId, 
    setActiveTab, 
    playSong, 
    setRemoteState,
    likedSongIds, 
    toggleLikeSong, 
    preferredLanguage 
  } = usePlayerStore();

  const [album, setAlbum] = useState<AlbumItem | null>(() => {
    if (!selectedAlbumId) return null;
    return AlbumCatalogEngine.getAlbumById(selectedAlbumId, preferredLanguage) || null;
  });
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  useEffect(() => {
    if (!selectedAlbumId) return;

    let isMounted = true;
    const baseAlbum = AlbumCatalogEngine.getAlbumById(selectedAlbumId, preferredLanguage);
    if (baseAlbum) setAlbum(prev => prev || baseAlbum);

    setIsLoadingTracks(true);

    const loadRealTracks = async () => {
      try {
        const { RealMusicEngine } = await import('@/lib/realMusicEngine');
        const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${selectedAlbumId}`);

        if (details && isMounted) {
          setAlbum(prev => ({
            id: details.id || selectedAlbumId,
            title: details.title || prev?.title || 'Album Details',
            artist: prev?.artist || 'Various Artists',
            coverUrl: details.coverUrl || prev?.coverUrl || '',
            releaseDate: prev?.releaseDate || '2024-01-01',
            releaseYear: prev?.releaseYear || 2024,
            trackCount: details.songs.length || prev?.trackCount || 0,
            durationSec: details.songs.reduce((s, t) => s + (t.duration || 200), 0),
            language: preferredLanguage,
            albumType: details.songs.length > 6 ? 'album' : 'ep',
            freshnessScore: prev?.freshnessScore || 90,
            trendingScore: prev?.trendingScore || 90,
            topScore: prev?.topScore || 90,
            tracks: details.songs
          }));
        }
      } catch (err) {
        console.error('Failed to load real album tracks:', err);
      } finally {
        if (isMounted) setIsLoadingTracks(false);
      }
    };

    loadRealTracks();

    return () => {
      isMounted = false;
    };
  }, [selectedAlbumId, preferredLanguage]);

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <Disc className="w-16 h-16 text-slate-600 mb-4 animate-spin" />
        <h2 className="text-xl font-bold text-white mb-2">Album Not Found</h2>
        <button 
          onClick={() => setActiveTab('album')} 
          className="px-5 py-2.5 rounded-full bg-[#fa233b] text-white text-xs font-bold hover:scale-105 transition-transform mt-4"
        >
          Back to Albums
        </button>
      </div>
    );
  }

  const handlePlayAll = () => {
    if (!album.tracks || album.tracks.length === 0) return;
    setRemoteState({ shuffleMode: 'OFF' });
    playSong(album.tracks[0], album.tracks);
  };

  const handleShufflePlay = () => {
    if (!album.tracks || album.tracks.length === 0) return;
    usePlayerStore.getState().shufflePlay(album.tracks, {
      contextType: 'ALBUM',
      contextUri: `raagax:album:${album.id}`,
      title: album.title,
    });
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${mins}:${remainingSec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-8 select-none">
      {/* Top Back Navigation */}
      <button 
        onClick={() => setSelectedAlbumId(null)}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all border border-white/5"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Albums
      </button>

      {/* Album Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#1b0914] via-[#12141c] to-[#07090e] p-6 sm:p-8 border border-white/10 overflow-hidden shadow-2xl">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl scale-125 pointer-events-none"
          style={{ backgroundImage: `url(${album.coverUrl})` }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8">
          <img 
            src={album.coverUrl} 
            alt={album.title}
            className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl object-cover shadow-2xl border border-white/10 flex-shrink-0"
          />

          <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fa233b]/20 border border-[#fa233b]/30 text-[#fa233b] text-xs font-bold uppercase tracking-wider">
              <Disc className="w-3.5 h-3.5" /> Full {album.albumType}
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight truncate leading-tight">
              {album.title}
            </h1>

            <p className="text-sm font-bold text-slate-300">
              {album.artist}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-medium text-slate-400 pt-1">
              <span>{album.releaseYear}</span>
              <span>•</span>
              <span className="text-white font-bold">{album.trackCount} Tracks</span>
              <span>•</span>
              <span>{Math.round(album.durationSec / 60)} min</span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[10px] font-bold uppercase">{album.language}</span>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-center sm:justify-start gap-3 pt-3">
              <button 
                onClick={handlePlayAll}
                className="px-6 py-3 rounded-full bg-[#fa233b] hover:bg-[#ff3b53] text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform shadow-xl shadow-red-500/30 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" /> Play Album
              </button>
              <button 
                onClick={handleShufflePlay}
                className="px-5 py-3 rounded-full font-bold text-xs flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all hover:scale-105 cursor-pointer"
              >
                <Shuffle className="w-4 h-4 text-slate-300" /> Shuffle
              </button>
              <button 
                onClick={() => setShowDownloadModal(true)}
                className="px-5 py-3 rounded-full font-bold text-xs flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all hover:scale-105 cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-300" /> Download
              </button>
            </div>
          </div>
        </div>
      </div>

      <BulkDownloadConfirmModal 
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        title={album.title}
        subtitle={album.artist}
        coverUrl={album.coverUrl}
        songs={album.tracks}
      />

      {/* Tracklist Section */}
      <div className="bg-[#0b0d14] rounded-2xl border border-white/5 p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span className="w-8 text-center">#</span>
            <span>Title</span>
          </div>
          <div className="flex items-center gap-4 pr-3">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="space-y-1">
          {album.tracks.map((track, idx) => (
            <div 
              key={track.id}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 group transition-colors cursor-pointer"
              onClick={() => playSong(track, album.tracks)}
            >
              <div className="flex items-center gap-4 min-w-0 flex-1 pr-4">
                <span className="w-8 text-center font-mono text-xs text-slate-500 font-bold group-hover:text-white transition-colors">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>

                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-white truncate leading-tight group-hover:text-[#fa233b] transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{track.artist}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleLikeSong(track.id)}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  <Heart className={`w-4 h-4 ${likedSongIds.includes(track.id) ? 'fill-[#fa233b] text-[#fa233b]' : ''}`} />
                </button>

                <span className="font-mono text-xs text-slate-400">
                  {formatDuration(track.duration)}
                </span>

                <SongActionMenu song={track} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


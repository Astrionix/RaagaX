'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Play, Pause, Heart, Download, Music, ArrowLeft, Disc, Users,
  ShieldCheck, Check, Shuffle, Sparkles, MoreVertical, Radio, Share2
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { getApiUrl } from '@/lib/config/apiConfig';
import { ArtistAvatar } from '@/components/common/ArtistAvatar';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { haptics } from '@/lib/haptics/HapticEngine';

const fetcher = (url: string) => fetch(getApiUrl(url)).then(res => res.json()).catch(() => null);

export function ArtistDetailView() {
  const { 
    selectedArtistId, 
    setSelectedArtistId, 
    setActiveTab, 
    setSelectedAlbumId,
    playSong, 
    currentSong,
    isPlaying,
    togglePlayPause,
    likedSongIds, 
    toggleLikeSong, 
    favoriteArtistIds = [],
    toggleFavoriteArtist,
    preferredLanguage,
    setToastMessage,
  } = usePlayerStore();
  
  const isFollowing = selectedArtistId ? favoriteArtistIds.includes(selectedArtistId) : false;
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    selectedArtistId ? `/api/artists/${selectedArtistId}?songCount=30&albumCount=20` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const artist = data?.data;

  // Multilingual discovery pipeline: Preferred language first -> Retain other languages -> Deduplicate -> Map to Song type
  const artistSongs: Song[] = useMemo(() => {
    if (!artist?.topSongs) return [];

    const preferred = artist.topSongs.filter((s: any) =>
      s.language?.toLowerCase() === preferredLanguage.toLowerCase() ||
      s.genre?.toLowerCase().includes(preferredLanguage.toLowerCase())
    );
    const others = artist.topSongs.filter((s: any) =>
      s.language?.toLowerCase() !== preferredLanguage.toLowerCase() &&
      !s.genre?.toLowerCase().includes(preferredLanguage.toLowerCase())
    );

    const combined = [...preferred, ...others];
    const seenIds = new Set<string>();
    const unique = combined.filter((s: any) => {
      if (!s.id || seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    }).slice(0, 25);

    return unique.map((s: any) => ({
      id: s.id,
      title: s.name || s.title || 'Unknown Title',
      artist: s.artists?.primary?.[0]?.name || artist.name,
      artistId: s.artists?.primary?.[0]?.id || artist.id,
      album: s.album?.name || '',
      albumId: s.album?.id || '',
      duration: Number(s.duration) || 210,
      coverUrl: s.image?.find?.((i: any) => i.quality === '500x500')?.url || s.image?.[s.image?.length - 1]?.url || artist.image?.[0]?.url || '',
      audioUrl: s.downloadUrl?.find?.((d: any) => d.quality === '320kbps')?.url || s.downloadUrl?.[s.downloadUrl?.length - 1]?.url || '',
      genre: s.genre || s.language || 'Music',
      category: 'global_trending' as const,
      releaseYear: Number(s.year || s.releaseYear) || 2024,
      plays: Number(s.playCount || s.plays) || 0,
      likes: Number(s.likes) || 0
    }));
  }, [artist, preferredLanguage]);

  const artistAlbums = useMemo(() => {
    if (!artist?.topAlbums) return [];

    const preferred = artist.topAlbums.filter((a: any) =>
      a.language?.toLowerCase() === preferredLanguage.toLowerCase() ||
      a.genre?.toLowerCase() === preferredLanguage.toLowerCase()
    );
    const others = artist.topAlbums.filter((a: any) =>
      a.language?.toLowerCase() !== preferredLanguage.toLowerCase() &&
      a.genre?.toLowerCase() !== preferredLanguage.toLowerCase()
    );

    const combined = [...preferred, ...others];
    const seenIds = new Set<string>();
    const unique = combined.filter((a: any) => {
      if (!a.id || seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    }).slice(0, 20);

    return unique.map((a: any) => ({
      id: a.id,
      title: a.name || a.title || 'Unknown',
      coverUrl: a.image?.find?.((i: any) => i.quality === '500x500')?.url || a.image?.[a.image?.length - 1]?.url || '',
      releaseYear: a.year || a.releaseYear || '',
      trackCount: a.songCount || a.trackCount || 0
    }));
  }, [artist, preferredLanguage]);

  const isCurrentArtistPlaying = artistSongs.some(s => s.id === currentSong?.id) && isPlaying;

  const handlePlayTopHits = () => {
    if (artistSongs.length === 0) return;
    haptics.mediumImpact();
    if (isCurrentArtistPlaying) {
      togglePlayPause();
    } else {
      playSong(artistSongs[0], artistSongs);
    }
  };

  const handleShuffleArtist = () => {
    if (artistSongs.length === 0) return;
    haptics.mediumImpact();
    usePlayerStore.getState().shufflePlay(artistSongs, {
      contextType: 'ARTIST',
      contextUri: `raagax:artist:${artist?.id || selectedArtistId}`,
      title: `${artist?.name || 'Artist'} Hits`,
    });
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${mins}:${remainingSec.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-24 text-white p-6 animate-pulse max-w-6xl mx-auto">
        <div className="h-64 bg-white/5 rounded-3xl w-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-white/5 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center text-white select-none">
        <Users className="w-16 h-16 text-[#fa233b] mb-4 animate-bounce" />
        <h2 className="text-xl font-bold mb-2">Artist Information Unavailable</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          We could not load artist metadata at this moment.
        </p>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => mutate()} 
            className="px-5 py-2.5 bg-[#fa233b] hover:bg-[#d91e32] text-white rounded-full text-xs font-bold transition-transform active:scale-95"
          >
            Retry
          </button>
          <button 
            onClick={() => setActiveTab('home')} 
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const artistAvatarUrl = artist.imageUrl || artist.image?.find?.((i: any) => i.quality === '500x500')?.url || artist.image?.[artist.image?.length - 1]?.url;

  return (
    <div className="relative min-h-screen text-white pb-36 select-none animate-in fade-in duration-300">
      {/* ── ATMOSPHERIC DYNAMIC ARTIST BACKGROUND ────────────────────────── */}
      <div
        className="absolute top-0 inset-x-0 h-[480px] pointer-events-none blur-[140px] opacity-35 scale-[1.25] transition-all duration-1000 -z-10"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 25%, var(--chameleon-primary, #fa233b) 0%, var(--chameleon-secondary, #8b5cf6) 40%, transparent 75%)`,
        }}
      />
      <div
        className="absolute top-0 inset-x-0 h-[420px] pointer-events-none blur-[110px] opacity-20 -z-10"
        style={{
          backgroundImage: `url(${artistAvatarUrl || '/app-icon.png'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* ── TOP NAVIGATION BAR ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-4 backdrop-blur-xl bg-[#08090d]/80 border-b border-white/5">
        <button
          onClick={() => {
            setSelectedArtistId(null);
            setActiveTab('home');
          }}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Explore</span>
        </button>

        <h2 className="text-sm font-bold text-white/90 truncate max-w-[240px] sm:max-w-[400px]">
          {artist.name}
        </h2>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: artist.name, text: `Listen to ${artist.name} on RaagaX!`, url: window.location.href });
            } else {
              setToastMessage('Artist link copied to clipboard');
            }
          }}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          title="Share Artist"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* ── ARTIST HERO SECTION ───────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-8">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 text-center md:text-left">
          {/* 3D Elevated Circular Artist Avatar */}
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-full overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85)] border-4 border-white/15 flex-shrink-0 group">
            <ArtistAvatar
              name={artist.name}
              id={artist.id}
              imageUrl={artistAvatarUrl}
              language={preferredLanguage}
              size="full"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* Artist Information & Badges */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fa233b]/15 border border-[#fa233b]/30 text-[11px] font-bold uppercase tracking-wider text-[#fa233b]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{artist.isVerified ? 'Verified Maestro' : 'Featured Artist'}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight">
              {artist.name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 font-medium flex items-center justify-center md:justify-start gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span>{(artist.followerCount / 1000000).toFixed(1)}M Followers</span>
              <span>•</span>
              <span className="capitalize">{preferredLanguage} Maestro</span>
            </p>
          </div>
        </div>

        {/* ── ACTION BUTTONS ROW ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3.5 mt-8 pt-6 border-t border-white/10">
          <button
            onClick={handlePlayTopHits}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#fa233b] hover:bg-[#d91e32] text-white font-black text-sm shadow-xl shadow-red-500/25 active:scale-95 transition-all cursor-pointer"
          >
            {isCurrentArtistPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white ml-0.5" /> Play Top Hits
              </>
            )}
          </button>

          <button
            onClick={handleShuffleArtist}
            className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <Shuffle className="w-4 h-4" /> Shuffle
          </button>

          <button
            onClick={() => {
              if (isFollowing) {
                setShowUnfollowModal(true);
              } else if (selectedArtistId) {
                toggleFavoriteArtist(selectedArtistId);
                haptics.lightImpact();
                setToastMessage(`✓ Following ${artist.name}. We'll keep you updated about new releases.`);
              }
            }}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-full font-bold text-sm border transition-all active:scale-95 cursor-pointer ${
              isFollowing
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90'
            }`}
          >
            {isFollowing ? <Check className="w-4 h-4 text-emerald-400 stroke-[3]" /> : <Heart className="w-4 h-4" />}
            <span>{isFollowing ? 'Following' : 'Follow'}</span>
          </button>
        </div>
      </div>

      {/* ── POPULAR TRACKS SECTION ────────────────────────────────────────── */}
      {artistSongs.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 mb-10">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider pb-3 mb-2 border-b border-white/10 flex items-center gap-2">
            <Music className="w-4 h-4 text-[#fa233b]" /> Popular Songs
          </h3>

          <div className="space-y-1.5">
            {artistSongs.map((song: Song, idx: number) => {
              const isPlayingCurrent = currentSong?.id === song.id;
              const rankNum = (idx + 1).toString().padStart(2, '0');

              return (
                <div
                  key={song.id}
                  onClick={() => playSong(song, artistSongs)}
                  className={`flex items-center justify-between p-2.5 sm:px-4 rounded-xl transition-all cursor-pointer group ${
                    isPlayingCurrent ? 'bg-[#fa233b]/15 border border-[#fa233b]/30' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span className="text-xs font-mono font-bold text-slate-500 w-4 text-center group-hover:hidden">
                      {rankNum}
                    </span>
                    <button className="w-4 text-[#fa233b] hidden group-hover:flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <img
                      src={song.coverUrl || '/app-icon.png'}
                      alt={song.title}
                      className="w-10 h-10 rounded-lg object-cover bg-slate-800 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-xs font-bold truncate ${isPlayingCurrent ? 'text-[#fa233b]' : 'text-white'}`}>
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                      {formatDuration(song.duration)}
                    </span>
                    <button
                      onClick={() => toggleLikeSong(song.id)}
                      className="p-1 text-slate-400 hover:text-[#fa233b] transition-transform active:scale-125"
                    >
                      <Heart className={`w-4 h-4 ${likedSongIds.includes(song.id) ? 'text-[#fa233b] fill-current' : ''}`} />
                    </button>
                    <SongActionMenu song={song} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DISCOGRAPHY / ALBUMS HORIZONTAL CAROUSEL ──────────────────────── */}
      {artistAlbums.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 mb-10">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider pb-3 mb-4 border-b border-white/10 flex items-center gap-2">
            <Disc className="w-4 h-4 text-[#fa233b]" /> Discography & Albums
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artistAlbums.map((alb: any) => (
              <div
                key={alb.id}
                onClick={() => {
                  setSelectedAlbumId(alb.id);
                  setActiveTab('album');
                }}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all space-y-3 cursor-pointer group hover:scale-[1.02]"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden shadow-lg relative bg-slate-900 border border-white/10">
                  <img
                    src={alb.coverUrl}
                    alt={alb.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-[#fa233b] transition-colors">
                    {alb.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {alb.releaseYear || 'Album'} {alb.trackCount ? `• ${alb.trackCount} Songs` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SIMILAR ARTISTS SECTION ────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider pb-3 mb-4 border-b border-white/10 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" /> Similar Artists You Might Like
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {POPULAR_ARTISTS.filter(a => a.id !== selectedArtistId).slice(0, 6).map((sim) => (
            <div
              key={sim.id}
              onClick={() => {
                setSelectedArtistId(sim.id);
              }}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all cursor-pointer group text-center space-y-2 hover:scale-105"
            >
              <img
                src={sim.image}
                alt={sim.name}
                className="w-20 h-20 rounded-full mx-auto object-cover bg-slate-800 shadow-md group-hover:border-[#fa233b] border-2 border-transparent transition-all"
              />
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#fa233b] truncate">{sim.name}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">{sim.genres.join(' • ')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── UNFOLLOW CONFIRMATION MODAL ────────────────────────────────────── */}
      {showUnfollowModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1c1d22] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <h3 className="text-lg font-black text-white">Unfollow {artist.name}?</h3>
            <p className="text-xs text-slate-400">
              You will no longer receive new-release updates or personalized recommendations for this artist.
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setShowUnfollowModal(false)}
                className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedArtistId) {
                    toggleFavoriteArtist(selectedArtistId);
                    setShowUnfollowModal(false);
                    setToastMessage(`Unfollowed ${artist.name}`);
                  }
                }}
                className="px-4 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-colors cursor-pointer"
              >
                Unfollow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

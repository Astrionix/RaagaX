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
    downloadedSongIds, 
    preferredLanguage,
    setToastMessage,
  } = usePlayerStore();
  
  const [isFollowing, setIsFollowing] = useState(false);

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
              const next = !isFollowing;
              setIsFollowing(next);
              haptics.lightImpact();
              setToastMessage(next ? `Following ${artist.name}` : `Unfollowed ${artist.name}`);
            }}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-full font-bold text-sm border transition-all active:scale-95 cursor-pointer ${
              isFollowing
                ? 'bg-white/20 border-white/40 text-white'
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
                  className={`group flex items-center justify-between gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none ${
                    isPlayingCurrent
                      ? 'bg-red-500/15 border border-red-500/30 text-white shadow-lg shadow-red-500/10'
                      : 'hover:bg-white/5 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  {/* Left: Rank / Waveform + Cover + Title */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-6 text-center flex-shrink-0 flex items-center justify-center">
                      {isPlayingCurrent ? (
                        <div className="flex items-end gap-[2px] h-4">
                          <span className={`w-1 bg-[#fa233b] rounded-full ${isPlaying ? 'animate-pulse' : ''} h-4`} />
                          <span className={`w-1 bg-[#fa233b] rounded-full ${isPlaying ? 'animate-pulse' : ''} h-2.5`} style={{ animationDelay: '150ms' }} />
                          <span className={`w-1 bg-[#fa233b] rounded-full ${isPlaying ? 'animate-pulse' : ''} h-3.5`} style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <span className="text-xs font-mono font-bold text-slate-500 group-hover:text-slate-300">
                          {rankNum}
                        </span>
                      )}
                    </div>

                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className="w-11 h-11 rounded-xl object-cover shadow-sm bg-slate-900 border border-white/10 flex-shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <h4 className={`text-sm font-bold truncate leading-snug ${isPlayingCurrent ? 'text-[#fa233b]' : 'text-white'}`}>
                        {song.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {song.album || song.artist}
                      </p>
                    </div>
                  </div>

                  {/* Right: Duration + Download + Action Menu */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-mono text-slate-500 hidden sm:inline">
                      {formatDuration(song.duration || 210)}
                    </span>

                    <DownloadStatusIndicator song={song} size="sm" />

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
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
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
    </div>
  );
}

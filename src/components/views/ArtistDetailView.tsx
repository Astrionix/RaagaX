'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Play, Pause, Heart, Download, Music, ArrowLeft, Disc, Users,
  ShieldCheck, Check, Shuffle, Sparkles, ListMusic, Info, Share2, Radio
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { getApiUrl } from '@/lib/config/apiConfig';
import { ArtistAvatar } from '@/components/common/ArtistAvatar';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { haptics } from '@/lib/haptics/HapticEngine';
import { DynamicArtworkAtmosphere } from '@/components/common/DynamicArtworkAtmosphere';
import { NavigationStack } from '@/lib/navigation/NavigationStack';

const fetcher = (url: string) => fetch(getApiUrl(url)).then(res => res.json()).catch(() => null);

type ArtistTab = 'popular' | 'songs' | 'albums' | 'playlists' | 'about';

export function ArtistDetailView() {
  const { 
    selectedArtistId, 
    setSelectedArtistId, 
    setActiveTab, 
    setSelectedAlbumId,
    setSelectedPlaylistId,
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
  
  const [activeSubTab, setActiveSubTab] = useState<ArtistTab>('popular');
  const isFollowing = selectedArtistId ? favoriteArtistIds.includes(selectedArtistId) : false;
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    selectedArtistId ? `/api/artists/${selectedArtistId}?songCount=50&albumCount=30` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const artist = data?.data;

  // Multilingual discovery pipeline
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
    });

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
    return combined.filter((a: any) => {
      if (!a.id || seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    }).map((a: any) => ({
      id: a.id,
      title: a.name || a.title || 'Unknown Album',
      artist: artist.name,
      coverUrl: a.image?.find?.((i: any) => i.quality === '500x500')?.url || a.image?.[a.image?.length - 1]?.url || '',
      releaseYear: a.year || '2024',
      trackCount: a.songCount || a.songs?.length || 0,
    }));
  }, [artist, preferredLanguage]);

  const isCurrentArtistPlaying = isPlaying && currentSong?.artistId === selectedArtistId;

  const handlePlayTopHits = () => {
    if (artistSongs.length === 0) return;
    haptics.mediumImpact();
    if (isCurrentArtistPlaying) {
      togglePlayPause();
    } else {
      playSong(artistSongs[0], artistSongs, {
        contextType: 'ARTIST',
        contextUri: `raagax:artist:${artist?.id || selectedArtistId}`,
        title: `${artist?.name || 'Artist'} Hits`,
      });
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

  const formattedBio = useMemo(() => {
    if (!artist) return '';
    const bio = (artist as any).bio;
    if (typeof bio === 'string' && bio.trim().length > 0) return bio;
    if (Array.isArray(bio) && bio.length > 0) {
      const intro = bio.find((b: any) => b?.title === 'Introduction' || b?.sequence === 1) || bio[0];
      if (typeof intro === 'string') return intro;
      if (intro && typeof intro === 'object' && typeof intro.text === 'string') return intro.text;
    }
    if (bio && typeof bio === 'object' && typeof bio.text === 'string') {
      return bio.text;
    }
    return `${artist.name} is one of the most prolific and celebrated artists in Indian music, known for iconic melodies and dynamic chart-topping hits across ${preferredLanguage || 'all languages'} and regional cinema.`;
  }, [artist, preferredLanguage]);

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
    <DynamicArtworkAtmosphere artworkUrl={artistAvatarUrl} isPlaying={isCurrentArtistPlaying}>
      <div className="-mx-3.5 sm:-mx-8 -mt-14 md:-mt-4 relative min-h-screen text-white pb-36 select-none animate-in fade-in duration-300">
        {/* ── TOP NAVIGATION BAR ────────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-3.5 sm:py-4 backdrop-blur-xl bg-[#08090d]/85 border-b border-white/10 shadow-md">
        <button
          onClick={() => {
            haptics.lightImpact();
            const handled = NavigationStack.getInstance().goBack((target) => {
              usePlayerStore.setState({
                activeTab: target.activeTab,
                selectedAlbumId: target.selectedAlbumId,
                selectedArtistId: target.selectedArtistId,
                selectedPlaylistId: target.selectedPlaylistId,
                isPlayerExpanded: target.isPlayerExpanded,
              });
            });
            if (!handled) {
              setSelectedArtistId(null);
              setActiveTab('home');
            }
          }}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <h2 className="text-sm font-bold text-white/90 truncate max-w-[240px] sm:max-w-[400px]">
          {artist.name}
        </h2>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: `${artist.name} on RaagaX`,
                text: `Listen to ${artist.name}'s top songs on RaagaX`,
                url: window.location.href,
              }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(window.location.href);
              setToastMessage('Link copied to clipboard!');
            }
          }}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer"
          title="Share Artist"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* ── ARTIST HERO HEADER ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-6">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 text-center md:text-left">
          {/* Artist Avatar Circle */}
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-full overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] border-4 border-white/10 flex-shrink-0 group">
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
              <span>{((artist.followerCount || 12400000) / 1000000).toFixed(1)}M Monthly Listeners</span>
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


          {/* ＋ Follow / ✓ Following subscription toggle */}
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
            {isFollowing ? <Check className="w-4 h-4 text-emerald-400 stroke-[3]" /> : <span>＋</span>}
            <span>{isFollowing ? 'Following' : 'Follow'}</span>
          </button>
        </div>
      </div>

      {/* ── 5 STRUCTURED TABS (Popular, Songs, Albums, Playlists, About) ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 mb-6 sm:mb-8">
        <div className="flex items-center gap-2.5 border-b border-white/10 overflow-x-auto no-scrollbar pb-3">
          {[
            { id: 'popular', label: 'Popular', icon: Sparkles },
            { id: 'songs', label: 'Songs', icon: Music },
            { id: 'albums', label: 'Albums', icon: Disc },
            { id: 'playlists', label: 'Playlists', icon: ListMusic },
            { id: 'about', label: 'About', icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as ArtistTab)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white/15 text-white border border-white/20 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB 1: POPULAR HITS ───────────────────────────────────────────── */}
      {activeSubTab === 'popular' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-10">
          <div className="space-y-1.5">
            {artistSongs.slice(0, 10).map((song: Song, idx: number) => {
              const isPlayingCurrent = currentSong?.id === song.id;
              const rankNum = (idx + 1).toString().padStart(2, '0');

              return (
                <div
                  key={song.id}
                  onClick={() => playSong(song, artistSongs, { type: 'artist', id: artist?.id || selectedArtistId || '', title: artist?.name || 'Artist', name: artist?.name || 'Artist' })}
                  className={`flex items-center justify-between p-2.5 sm:px-4 rounded-xl transition-all cursor-pointer group ${
                    isPlayingCurrent ? 'bg-white/[0.08] border border-white/15' : 'hover:bg-white/5 border border-transparent'
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
                      <h4 className="text-xs font-bold truncate text-white">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.album || song.artist}</p>
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

      {/* ── TAB 2: ALL SONGS ──────────────────────────────────────────────── */}
      {activeSubTab === 'songs' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-2">
          {artistSongs.map((song: Song, idx: number) => {
            const isPlayingCurrent = currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                onClick={() => playSong(song, artistSongs)}
                className={`flex items-center justify-between p-2.5 sm:px-4 rounded-xl transition-all cursor-pointer group ${
                  isPlayingCurrent ? 'bg-white/[0.08] border border-white/15' : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <img
                    src={song.coverUrl || '/app-icon.png'}
                    alt={song.title}
                    className="w-10 h-10 rounded-lg object-cover bg-slate-800 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold truncate text-white">
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.album || song.artist}</p>
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
      )}

      {/* ── TAB 3: ALBUMS & DISCOGRAPHY ──────────────────────────────────── */}
      {activeSubTab === 'albums' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
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

      {/* ── TAB 4: PLAYLISTS ─────────────────────────────────────────────── */}
      {activeSubTab === 'playlists' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[
              { id: 'mix-1', title: `${artist.name} Hits Mix`, count: artistSongs.length, img: artistAvatarUrl },
              { id: 'mix-2', title: `${artist.name} Radio`, count: 25, img: artistSongs[1]?.coverUrl || artistAvatarUrl },
              { id: 'mix-3', title: `Best of ${artist.name} Melodies`, count: 18, img: artistSongs[2]?.coverUrl || artistAvatarUrl },
            ].map((pl) => (
              <div
                key={pl.id}
                onClick={handlePlayTopHits}
                className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all cursor-pointer group space-y-3 hover:scale-[1.02]"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden shadow-lg relative bg-slate-900 border border-white/10">
                  <img
                    src={pl.img}
                    alt={pl.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-[#fa233b] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-xl transition-all">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-[#fa233b]">{pl.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">RaagaX Curated • {pl.count} Songs</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: ABOUT ─────────────────────────────────────────────────── */}
      {activeSubTab === 'about' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-2 sm:pt-4 space-y-6">
          <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.04] border border-white/10 space-y-4 shadow-xl backdrop-blur-sm">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-[#fa233b]" /> About {artist.name}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              {formattedBio}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-5 border-t border-white/10">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Monthly Listeners</span>
                <span className="text-base font-mono font-black text-white">{((artist.followerCount || 12400000) / 1000000).toFixed(1)}M</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Primary Region</span>
                <span className="text-base font-bold text-white capitalize">{preferredLanguage || 'Global'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Status</span>
                <span className="text-base font-bold text-emerald-400">Verified Artist</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
  </DynamicArtworkAtmosphere>
  );
}

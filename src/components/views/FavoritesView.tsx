import React, { useState, useEffect, useRef } from 'react';
import { Heart, Play, User, Music, Disc3, Shuffle, Loader2 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { SongResolver } from '@/lib/discovery/SongResolver';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { AlbumCatalogEngine, AlbumItem } from '@/lib/albumCatalog';
import { Song } from '@/types/music';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';

export function FavoritesView() {
  const [activeSubTab, setActiveSubTab] = useState<'songs' | 'albums' | 'artists'>('songs');
  const {
    queue,
    likedSongIds = [],
    likedSongs = [],
    cloudDownloadRecords = [],
    favoriteArtistIds = [],
    favoriteAlbumIds = [],
    toggleFavoriteAlbum,
    setSelectedAlbumId,
    setActiveTab,
    playSong,
    togglePlayPause,
    isPlaying,
    currentSong,
    toggleLikeSong,
    setSelectedArtistId,
    preferredLanguage = 'Telugu',
  } = usePlayerStore();

  const [offlineTracks, setOfflineTracks] = useState<Song[]>([]);
  const [resolvedSongsMap, setResolvedSongsMap] = useState<Record<string, Song>>({});
  const [resolvedAlbums, setResolvedAlbums] = useState<AlbumItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState<boolean>(false);
  const resolvingRef = useRef<boolean>(false);

  useEffect(() => {
    OfflineCatalog.getInstance().getAllTracks().then((tracks) => {
      if (tracks && tracks.length > 0) {
        const mapped: Song[] = tracks.map((t) => ({
          id: t.trackId,
          title: t.title,
          artist: t.artist,
          album: t.album || 'Downloaded',
          coverUrl: t.artworkUrl || '/app-icon.png',
          duration: t.duration || Math.round(t.durationMs / 1000),
          audioUrl: '',
          artistId: 'offline',
          albumId: 'offline',
          genre: 'Various',
          category: 'global_trending',
          year: new Date(t.downloadedAt).getFullYear().toString(),
          releaseYear: new Date(t.downloadedAt).getFullYear(),
          plays: 0,
          likes: 0,
          quality: 'HIGH',
          language: 'Mixed',
        }));
        setOfflineTracks(mapped);
      }
    });
  }, [likedSongIds.length]);

  // Combine known store songs, queue, and offline tracks into seed map
  const knownMap = new Map<string, Song>();
  likedSongs.forEach((s) => { if (s?.id) knownMap.set(s.id, s); });
  queue.forEach((s) => { if (s?.id) knownMap.set(s.id, s); });
  offlineTracks.forEach((s) => { if (s?.id) knownMap.set(s.id, s); });
  Object.values(resolvedSongsMap).forEach((s) => { if (s?.id) knownMap.set(s.id, s); });
  cloudDownloadRecords.forEach((r) => {
    if (r?.song_id && !knownMap.has(r.song_id)) {
      knownMap.set(r.song_id, {
        id: r.song_id,
        title: r.song_title || 'Unknown Title',
        artist: r.song_artist || 'Unknown Artist',
        artistId: `art-${r.song_id}`,
        album: 'Liked Songs',
        albumId: `alb-${r.song_id}`,
        coverUrl: r.song_cover || '/app-icon.png',
        duration: r.song_duration || 180,
        audioUrl: '',
        genre: 'Various',
        category: 'global_trending',
        releaseYear: new Date().getFullYear(),
        plays: 0,
        likes: 1,
      });
    }
  });

  // Automatically fetch metadata for any liked song IDs not yet in memory
  useEffect(() => {
    if (likedSongIds.length === 0) return;
    const missingIds = likedSongIds.filter((id) => !knownMap.has(id));
    if (missingIds.length === 0 || resolvingRef.current) return;

    resolvingRef.current = true;
    setIsLoading(true);

    SongResolver.resolveSongs(missingIds)
      .then((resolved) => {
        if (resolved && resolved.length > 0) {
          setResolvedSongsMap((prev) => {
            const updated = { ...prev };
            resolved.forEach((song) => {
              if (song?.id) updated[song.id] = song;
            });
            return updated;
          });
        }
      })
      .catch((e) => {
        console.warn('[FavoritesView] Error resolving missing liked songs:', e);
      })
      .finally(() => {
        resolvingRef.current = false;
        setIsLoading(false);
      });
  }, [likedSongIds]);

  // Resolve Liked Albums
  useEffect(() => {
    if (favoriteAlbumIds.length === 0) {
      setResolvedAlbums([]);
      return;
    }

    setIsLoadingAlbums(true);
    const resolved: AlbumItem[] = [];
    const missingIds: string[] = [];

    for (const albumId of favoriteAlbumIds) {
      const known = AlbumCatalogEngine.getAlbumById(albumId, preferredLanguage);
      if (known) {
        resolved.push(known);
      } else {
        missingIds.push(albumId);
      }
    }

    if (missingIds.length === 0) {
      setResolvedAlbums(resolved);
      setIsLoadingAlbums(false);
      return;
    }

    // Fetch missing albums from API
    Promise.all(
      missingIds.map(async (id) => {
        try {
          const { RealMusicEngine } = await import('@/lib/realMusicEngine');
          const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${id}`);
          if (details) {
            return {
              id,
              title: details.title,
              artist: details.songs?.[0]?.artist || 'Soundtrack',
              artistId: `art-${id}`,
              coverUrl: details.coverUrl || '/app-icon.png',
              releaseDate: '2024-01-01',
              releaseYear: 2024,
              trackCount: details.songs?.length || 6,
              durationSec: (details.songs?.length || 6) * 210,
              language: preferredLanguage,
              albumType: 'soundtrack' as const,
              freshnessScore: 90,
              trendingScore: 90,
            };
          }
        } catch {}
        return null;
      })
    ).then((fetched) => {
      const allResolved = [...resolved, ...(fetched.filter(Boolean) as AlbumItem[])];
      setResolvedAlbums(allResolved);
      setIsLoadingAlbums(false);
    });
  }, [favoriteAlbumIds, preferredLanguage]);

  // Single canonical resolved liked songs array
  const resolvedLikedSongs: Song[] = likedSongIds
    .map((id) => knownMap.get(id) || {
      id,
      title: 'Liked Track',
      artist: 'Unknown Artist',
      album: 'Liked Songs',
      coverUrl: '/app-icon.png',
      duration: 210,
      audioUrl: '',
      artistId: 'unknown',
      albumId: 'unknown',
      genre: 'Various',
      category: 'global_trending' as const,
      releaseYear: new Date().getFullYear(),
      plays: 0,
      likes: 1
    });

  const favoriteArtists = POPULAR_ARTISTS.filter((a) => favoriteArtistIds.includes(a.id));

  const isLikedListPlaying = isPlaying && currentSong && resolvedLikedSongs.some((s) => s.id === currentSong.id);

  const handlePlayAll = (shuffle = false) => {
    if (resolvedLikedSongs.length === 0) return;
    if (isLikedListPlaying && !shuffle) {
      togglePlayPause();
      return;
    }
    const tracklist = shuffle ? [...resolvedLikedSongs].sort(() => Math.random() - 0.5) : resolvedLikedSongs;
    playSong(tracklist[0], tracklist);
  };

  const handleOpenAlbum = (albumId: string) => {
    setSelectedAlbumId(albumId);
    setActiveTab('album');
  };

  return (
    <div className="space-y-6 pb-12 text-white select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3.5 pt-1">
        <div className="w-12 h-12 rounded-2xl bg-[#FA233B]/15 border border-[#FA233B]/30 flex items-center justify-center text-[#FA233B] shadow-lg shadow-[#FA233B]/15 flex-shrink-0">
          <Heart className="w-6 h-6 fill-current" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Your Favorites</h1>
          <p className="text-xs text-[#8E92A4] mt-0.5">Liked songs, albums, and artists in your cloud library</p>
        </div>
      </div>

      {/* Sub Tabs and Mobile-First Play Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          {[
            { id: 'songs', label: 'Songs', icon: Music, count: likedSongIds.length },
            { id: 'albums', label: 'Albums', icon: Disc3, count: favoriteAlbumIds.length },
            { id: 'artists', label: 'Artists', icon: User, count: favoriteArtistIds.length },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#FA233B] text-white shadow-md shadow-[#FA233B]/25'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isActive ? 'bg-white/25 text-white' : 'bg-white/10 text-slate-400'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile & Desktop Play All & Shuffle Buttons */}
        {activeSubTab === 'songs' && resolvedLikedSongs.length > 0 && (
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto pt-1 sm:pt-0">
            <button
              onClick={() => handlePlayAll(false)}
              className="h-11 sm:h-10 px-5 rounded-full bg-[#FA233B] hover:bg-[#D90429] active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FA233B]/30 transition-all cursor-pointer"
              aria-label="Play all liked songs"
            >
              <Play className={`w-4 h-4 fill-white ${isLikedListPlaying ? 'animate-pulse' : ''}`} />
              <span>{isLikedListPlaying ? 'Pause' : 'Play All'}</span>
            </button>
            <button
              onClick={() => handlePlayAll(true)}
              className="h-11 sm:h-10 px-4 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/15 shadow-md transition-all cursor-pointer"
              aria-label="Shuffle liked songs"
            >
              <Shuffle className="w-4 h-4 text-slate-200" />
              <span>Shuffle</span>
            </button>
          </div>
        )}
      </div>

      {/* Content View */}
      {activeSubTab === 'songs' && (
        <div className="space-y-3">
          {isLoading && resolvedLikedSongs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-3 bg-white/[0.02] rounded-2xl border border-white/5 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#FA233B] animate-spin" />
              <p className="text-xs font-bold text-white">Loading your favorites...</p>
            </div>
          ) : resolvedLikedSongs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {resolvedLikedSongs.map((song, idx) => (
                <div
                  key={`${song.id}-${idx}`}
                  className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-all flex items-center justify-between group shadow-sm"
                >
                  <div
                    className="flex items-center gap-3.5 cursor-pointer min-w-0 flex-1"
                    onClick={() => playSong(song, resolvedLikedSongs)}
                  >
                    <img
                      src={song.coverUrl || '/app-icon.png'}
                      alt={song.title}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                      }}
                      className="w-11 h-11 rounded-xl object-cover shadow-sm flex-shrink-0 bg-slate-800"
                    />
                    <div className="min-w-0 flex-1 pr-2">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[#FA233B] transition-colors truncate">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <DownloadStatusIndicator song={song} size="sm" showPercentage />
                    <button
                      onClick={() => toggleLikeSong(song.id)}
                      aria-label="Unlike song"
                      className="p-2 text-[#FA233B] hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                    <SongActionMenu song={song} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-white/[0.02] rounded-2xl border border-white/5">
              <Heart className="w-8 h-8 text-[#8E92A4] mx-auto opacity-50" />
              <p className="text-xs font-bold text-white">No liked songs yet.</p>
              <p className="text-[11px] text-[#8E92A4]">Tap the heart icon on any track to save it here.</p>
            </div>
          )}
        </div>
      )}

      {/* Liked Albums Sub-Tab */}
      {activeSubTab === 'albums' && (
        <div className="space-y-3">
          {isLoadingAlbums && resolvedAlbums.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-3 bg-white/[0.02] rounded-2xl border border-white/5 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#FA233B] animate-spin" />
              <p className="text-xs font-bold text-white">Loading your favorite albums...</p>
            </div>
          ) : resolvedAlbums.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {resolvedAlbums.map((album) => (
                <div
                  key={album.id}
                  onClick={() => handleOpenAlbum(album.id)}
                  className="group relative p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] hover:border-white/20 transition-all cursor-pointer shadow-sm hover:shadow-xl flex flex-col justify-between"
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-slate-900 shadow-md">
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAlbum(album.id);
                        }}
                        className="w-10 h-10 rounded-full bg-[#fa233b] text-white flex items-center justify-center shadow-lg shadow-red-500/40 hover:scale-110 transition-transform"
                      >
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[#fa233b] transition-colors truncate">
                        {album.title}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteAlbum(album.id);
                        }}
                        title="Remove from favorites"
                        className="p-1 text-[#fa233b] hover:scale-110 transition-transform flex-shrink-0"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">{album.artist}</p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {album.releaseYear || 2024} • {album.trackCount || 6} Songs
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-white/[0.02] rounded-2xl border border-white/5">
              <Disc3 className="w-8 h-8 text-[#8E92A4] mx-auto opacity-50" />
              <p className="text-xs font-bold text-white">No favorite albums yet.</p>
              <p className="text-[11px] text-[#8E92A4]">Tap the heart icon on any album page to save it here.</p>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {(favoriteArtists.length > 0 ? favoriteArtists : POPULAR_ARTISTS.slice(0, 6)).map((artist) => (
            <div
              key={artist.id}
              onClick={() => setSelectedArtistId(artist.id)}
              className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/5 text-center space-y-2.5 cursor-pointer group transition-all"
            >
              <img
                src={artist.image}
                alt={artist.name}
                className="w-18 h-18 rounded-full mx-auto object-cover shadow-md group-hover:scale-105 transition-transform bg-slate-800"
              />
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#FA233B] transition-colors truncate">
                  {artist.name}
                </h4>
                <p className="text-[10px] text-[#8E92A4] mt-0.5 truncate">{artist.genres.join(' • ')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

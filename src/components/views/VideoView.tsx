'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import {
  Tv, Search, Play, Heart, Flame, Sparkles, User, Disc3,
  Film, Mic2, Radio, Globe, Check, Loader2, Music, Shuffle, ChevronRight, X,
  Bookmark, ListMusic, Share2, Compass, Plus
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { ALL_LANGUAGES } from './DiscoveryHubView';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { haptics } from '@/lib/haptics/HapticEngine';

export type WatchTab = 'feed' | 'trending' | 'new' | 'following' | 'recommended' | 'saved';
export type VideoContentType = 'all' | 'official' | 'lyrics' | 'movie' | 'live' | 'visualizer';

interface VideoFeedData {
  trendingVideos: Song[];
  newVideos: Song[];
  popularVideos: Song[];
  movieSongs?: Song[];
  livePerformances?: Song[];
}

export function VideoView() {
  const {
    preferredLanguage = 'Telugu',
    setPreferredLanguage,
    playSong,
    currentSong,
    isPlaying,
    likedSongIds,
    toggleLikeSong,
    likedSongs = [],
    favoriteArtistIds = [],
    setSelectedArtistId,
    setActiveTab,
    setToastMessage,
  } = usePlayerStore();

  const [activeWatchTab, setActiveWatchTab] = useState<WatchTab>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedContentType, setSelectedContentType] = useState<VideoContentType>('all');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch Video Search Results when debouncedQuery is present
  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    setIsSearching(true);

    const targetQuery = `${debouncedQuery} ${preferredLanguage} Official Video`;
    fetch(`/api/search/songs?q=${encodeURIComponent(targetQuery)}&limit=30`)
      .then((res) => res.json())
      .then((json) => {
        if (!isCancelled) {
          const results = json.data?.results || json.results || json.data || [];
          const mapped = Array.isArray(results) ? results.map((s: any) => ({
            id: s.id,
            title: s.name || s.title || 'Unknown Video',
            artist: s.artists?.primary?.[0]?.name || s.artist || 'Artist',
            artistId: s.artists?.primary?.[0]?.id || s.artistId || '',
            album: s.album?.name || s.album || '',
            albumId: s.album?.id || s.albumId || '',
            duration: Number(s.duration) || 210,
            coverUrl: s.image?.find?.((i: any) => i.quality === '500x500')?.url || s.image?.[s.image?.length - 1]?.url || s.coverUrl || '',
            audioUrl: s.downloadUrl?.find?.((d: any) => d.quality === '320kbps')?.url || s.downloadUrl?.[s.downloadUrl?.length - 1]?.url || s.audioUrl || '',
            genre: s.language || preferredLanguage,
            category: 'global_trending' as const,
            releaseYear: Number(s.year || s.releaseYear) || 2024,
            plays: Number(s.playCount || s.plays) || 0,
            likes: 1,
            language: s.language || preferredLanguage,
          })) : [];
          setSearchResults(mapped);
          setIsSearching(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setIsSearching(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery, preferredLanguage]);

  // Fetch Main Video Discovery Shelves for Active Language
  const { data: discoveryData, isLoading: isLoadingShelves } = useSWR(
    `/api/home/discovery?type=videos&lang=${encodeURIComponent(preferredLanguage)}`,
    (url: string) => fetch(url).then((res) => res.json()),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const videoFeed: VideoFeedData = useMemo(() => {
    const raw = discoveryData?.data;
    if (!raw) {
      return {
        trendingVideos: [],
        newVideos: [],
        popularVideos: [],
      };
    }
    return {
      trendingVideos: raw.trendingVideos || [],
      newVideos: raw.newVideos || [],
      popularVideos: raw.popularVideos || [],
    };
  }, [discoveryData]);

  // Artists You Follow Shelves
  const followedArtistVideos = useMemo(() => {
    const allVideos = [
      ...videoFeed.trendingVideos,
      ...videoFeed.newVideos,
      ...videoFeed.popularVideos,
    ];
    if (favoriteArtistIds.length === 0) return [];
    return allVideos.filter((v) =>
      favoriteArtistIds.some(
        (favId) => favId === v.artistId || v.artist.toLowerCase().includes(favId.toLowerCase())
      )
    );
  }, [videoFeed, favoriteArtistIds]);

  const handlePlayVideo = useCallback((song: Song, queue: Song[]) => {
    haptics.mediumImpact();
    playSong(song, queue, {
      contextType: 'DISCOVERY_VIDEO',
      contextUri: `raagax:video:${preferredLanguage.toLowerCase()}`,
      title: `${preferredLanguage} Music Videos`,
    });
    usePlayerStore.getState().setRenderer('video');
  }, [playSong, preferredLanguage]);

  return (
    <div className="space-y-8 pb-32 text-white select-none animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* ── HEADER BANNER: 🎬 WATCH DISCOVERY HUB ───────────────────────────── */}
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden bg-gradient-to-r from-[#1a0a10] via-[#101118] to-[#0a0b10] border border-red-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fa233b] to-[#b01020] flex items-center justify-center shadow-lg shadow-red-500/30">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-widest text-[#fa233b] uppercase bg-red-500/15 px-2 py-0.5 rounded border border-red-500/30">
                    CONTINUOUS WATCH
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    YouTube-Style Music Video Platform
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                  🎬 {preferredLanguage} Watch
                </h1>
              </div>
            </div>

            {/* Quick Play Trending Mix Button */}
            {videoFeed.trendingVideos.length > 0 && (
              <button
                onClick={() => handlePlayVideo(videoFeed.trendingVideos[0], videoFeed.trendingVideos)}
                className="px-6 py-3 rounded-full bg-[#fa233b] hover:bg-[#d91c2e] text-white font-black text-xs flex items-center gap-2.5 shadow-xl shadow-red-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white ml-0.5" />
                <span>Play {preferredLanguage} Watch Feed</span>
              </button>
            )}
          </div>

          {/* ── VIDEO SEARCH BAR ────────────────────────────────────────────── */}
          <div className="relative w-full max-w-2xl pt-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 mt-1" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${preferredLanguage} music videos, artists, movie songs...`}
              className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white/10 text-xs sm:text-sm text-white placeholder:text-slate-400 border border-white/15 focus:border-[#fa233b] focus:bg-black/60 focus:outline-none transition-all shadow-inner font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── YOUTUBE-STYLE WATCH NAVIGATION TABS & LANGUAGE BAR ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Watch Sub-Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'feed', label: '🏠 Feed', icon: Compass },
            { id: 'trending', label: '🔥 Trending', icon: Flame },
            { id: 'new', label: '🆕 New Videos', icon: Sparkles },
            { id: 'following', label: '🎤 Following', icon: User },
            { id: 'recommended', label: '❤️ Recommended', icon: Disc3 },
            { id: 'saved', label: '📚 Saved Videos', icon: Bookmark },
          ].map((tab) => {
            const isActive = activeWatchTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  haptics.lightImpact();
                  setActiveWatchTab(tab.id as WatchTab);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#fa233b] to-[#d91c2e] text-white shadow-lg shadow-red-500/25 border border-red-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Global Strict Language Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {ALL_LANGUAGES.map((lang) => {
            const isSelected = preferredLanguage.toLowerCase() === lang.id.toLowerCase();
            return (
              <button
                key={lang.id}
                onClick={() => {
                  haptics.lightImpact();
                  setPreferredLanguage(lang.id);
                  setToastMessage(`Switched Watch to ${lang.label}`);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-black font-black shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <span>{lang.flag} {lang.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── VIDEO CONTENT CLASSIFICATION CHIPS ──────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: 'All Videos' },
          { id: 'official', label: '🎬 Official Music Videos' },
          { id: 'movie', label: '🎞️ Blockbuster Movie Songs' },
          { id: 'lyrics', label: '🎤 Lyric Videos' },
          { id: 'live', label: '🎙️ Live Performances' },
          { id: 'visualizer', label: '🎧 Visualizers' },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setSelectedContentType(chip.id as VideoContentType)}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedContentType === chip.id
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 font-black'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* ── SEARCH RESULTS (If user is searching) ───────────────────────────── */}
      {debouncedQuery ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-[#fa233b]" /> Search Results for "{debouncedQuery}" ({preferredLanguage})
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {searchResults.length} videos found
            </span>
          </div>

          {isSearching ? (
            <div className="py-24 text-center text-slate-400 space-y-3 flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-[#fa233b] animate-spin" />
              <p className="text-xs font-bold">Finding matching music videos...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-2 bg-white/[0.02] rounded-3xl border border-white/10 p-8">
              <Tv className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-white">No Music Videos Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Try searching with a different song title or artist name in {preferredLanguage}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {searchResults.map((song) => (
                <VideoCard
                  key={`search-vid-${song.id}`}
                  song={song}
                  onPlay={() => handlePlayVideo(song, searchResults)}
                  isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── YOUTUBE-STYLE DEDICATED FEED VIEWS ───────────────────────────────── */
        <div className="space-y-10">
          {isLoadingShelves ? (
            <div className="py-28 text-center text-slate-400 space-y-3 flex flex-col items-center">
              <Loader2 className="w-9 h-9 text-[#fa233b] animate-spin" />
              <p className="text-xs font-bold tracking-wider">Loading {preferredLanguage} Watch Feed...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: ALL FEED (YouTube-Style Comprehensive Feed) */}
              {activeWatchTab === 'feed' && (
                <div className="space-y-10">
                  {/* Shelf A: Trending */}
                  {videoFeed.trendingVideos.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                          <Flame className="w-4 h-4" /> Trending {preferredLanguage} Videos
                        </h3>
                        <button
                          onClick={() => setActiveWatchTab('trending')}
                          className="text-xs font-bold text-slate-400 hover:text-white"
                        >
                          View All →
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {videoFeed.trendingVideos.slice(0, 8).map((song) => (
                          <VideoCard
                            key={`feed-trend-${song.id}`}
                            song={song}
                            onPlay={() => handlePlayVideo(song, videoFeed.trendingVideos)}
                            isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shelf B: New Releases */}
                  {videoFeed.newVideos.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#fa233b]" /> New {preferredLanguage} Releases
                        </h3>
                        <button
                          onClick={() => setActiveWatchTab('new')}
                          className="text-xs font-bold text-slate-400 hover:text-white"
                        >
                          View All →
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {videoFeed.newVideos.slice(0, 8).map((song) => (
                          <VideoCard
                            key={`feed-new-${song.id}`}
                            song={song}
                            onPlay={() => handlePlayVideo(song, videoFeed.newVideos)}
                            isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shelf C: Followed Artists */}
                  {followedArtistVideos.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                          <User className="w-4 h-4" /> From Artists You Follow
                        </h3>
                        <button
                          onClick={() => setActiveWatchTab('following')}
                          className="text-xs font-bold text-slate-400 hover:text-white"
                        >
                          View All →
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {followedArtistVideos.map((song) => (
                          <VideoCard
                            key={`feed-follow-${song.id}`}
                            song={song}
                            onPlay={() => handlePlayVideo(song, followedArtistVideos)}
                            isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shelf D: Popular & All-Time Hits */}
                  {videoFeed.popularVideos.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                          <Disc3 className="w-4 h-4 text-red-400" /> Popular & All-Time Hits ({preferredLanguage})
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {videoFeed.popularVideos.slice(0, 8).map((song) => (
                          <VideoCard
                            key={`feed-pop-${song.id}`}
                            song={song}
                            onPlay={() => handlePlayVideo(song, videoFeed.popularVideos)}
                            isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TRENDING VIDEOS */}
              {activeWatchTab === 'trending' && (
                <div className="space-y-4">
                  <h3 className="text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Flame className="w-4 h-4" /> Trending {preferredLanguage} Videos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {videoFeed.trendingVideos.map((song) => (
                      <VideoCard
                        key={`tab-trend-${song.id}`}
                        song={song}
                        onPlay={() => handlePlayVideo(song, videoFeed.trendingVideos)}
                        isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: NEW VIDEOS */}
              {activeWatchTab === 'new' && (
                <div className="space-y-4">
                  <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#fa233b]" /> New {preferredLanguage} Releases
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {videoFeed.newVideos.map((song) => (
                      <VideoCard
                        key={`tab-new-${song.id}`}
                        song={song}
                        onPlay={() => handlePlayVideo(song, videoFeed.newVideos)}
                        isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: FOLLOWING */}
              {activeWatchTab === 'following' && (
                <div className="space-y-4">
                  <h3 className="text-base font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <User className="w-4 h-4" /> Videos From Artists You Follow
                  </h3>
                  {followedArtistVideos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {followedArtistVideos.map((song) => (
                        <VideoCard
                          key={`tab-follow-${song.id}`}
                          song={song}
                          onPlay={() => handlePlayVideo(song, followedArtistVideos)}
                          isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 space-y-2 bg-white/[0.02] rounded-3xl border border-white/10 p-8">
                      <User className="w-12 h-12 text-slate-600 mx-auto" />
                      <h4 className="text-base font-bold text-white">No Followed Artists Yet</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Follow your favorite artists like Sid Sriram, Anirudh, and Devi Sri Prasad to see their latest music videos here.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: RECOMMENDED */}
              {activeWatchTab === 'recommended' && (
                <div className="space-y-4">
                  <h3 className="text-base font-black uppercase tracking-wider text-red-400 flex items-center gap-2">
                    <Disc3 className="w-4 h-4" /> Recommended {preferredLanguage} Music Videos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {videoFeed.popularVideos.map((song) => (
                      <VideoCard
                        key={`tab-rec-${song.id}`}
                        song={song}
                        onPlay={() => handlePlayVideo(song, videoFeed.popularVideos)}
                        isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: SAVED VIDEOS */}
              {activeWatchTab === 'saved' && (
                <div className="space-y-4">
                  <h3 className="text-base font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
                    <Bookmark className="w-4 h-4" /> Your Saved Videos & Favorites
                  </h3>
                  {likedSongs.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {likedSongs.map((song) => (
                        <VideoCard
                          key={`tab-saved-${song.id}`}
                          song={song}
                          onPlay={() => handlePlayVideo(song, likedSongs)}
                          isCurrentPlaying={currentSong?.id === song.id && isPlaying}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 space-y-2 bg-white/[0.02] rounded-3xl border border-white/10 p-8">
                      <Heart className="w-12 h-12 text-slate-600 mx-auto" />
                      <h4 className="text-base font-bold text-white">No Saved Videos</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Tap the heart button on any music video to save it to your collection.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── PREMIUM 16:9 CINEMA VIDEO CARD ──────────────────────────────────────────
interface VideoCardProps {
  song: Song;
  onPlay: () => void;
  isCurrentPlaying: boolean;
}

function VideoCard({ song, onPlay, isCurrentPlaying }: VideoCardProps) {
  const { likedSongIds, toggleLikeSong } = usePlayerStore();
  const isLiked = likedSongIds.includes(song.id);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={onPlay}
      className={`p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-white/20 transition-all cursor-pointer group space-y-3 hover:scale-[1.02] shadow-sm ${
        isCurrentPlaying ? 'border-[#fa233b]/40 ring-2 ring-[#fa233b]/20 bg-red-500/5' : ''
      }`}
    >
      {/* 16:9 Widescreen Cinema Thumbnail */}
      <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg relative bg-black border border-white/10 flex items-center justify-center">
        <img
          src={song.coverUrl || '/app-icon.png'}
          alt={song.title}
          className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
        />

        {/* Dark Vignette Overlay & Center Play Button */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#fa233b] text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* Top Left Badge */}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md text-[9px] font-black uppercase tracking-wider text-amber-400 border border-amber-400/20">
          HD Cinema
        </span>

        {/* Bottom Right Duration Badge */}
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md text-[10px] font-mono font-bold text-white">
          {formatDuration(song.duration || 210)}
        </span>
      </div>

      {/* Metadata & Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className={`text-xs sm:text-sm font-bold truncate group-hover:text-[#fa233b] transition-colors ${
            isCurrentPlaying ? 'text-[#fa233b]' : 'text-white'
          }`}>
            {song.title}
          </h4>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            {song.artist} {song.album ? `• ${song.album}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleLikeSong(song.id)}
            className="p-1 text-slate-400 hover:text-[#fa233b] transition-transform active:scale-125 cursor-pointer"
            title="Like Video"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'text-[#fa233b] fill-current' : ''}`} />
          </button>
          <SongActionMenu song={song} />
        </div>
      </div>
    </div>
  );
}

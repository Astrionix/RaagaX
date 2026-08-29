'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Sparkles, Flame, Mic, Heart, Zap, Activity, Music2, Disc, Award,
  Compass, Sun, Radio, Shield, Layers, Feather, Coffee, Cloud, Volume2,
  SunMedium, Globe, Crown, Film, Tv, BookOpen, Mic2, Moon,
  HeartHandshake, Guitar, ArrowLeft, Play, Shuffle, Search,
  ChevronRight, Music, Filter, Check, Loader2, ListMusic
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { GENRE_CATALOG, GenreDefinition, getGenreById } from '@/lib/genres/genreCatalog';
import { DynamicArtworkAtmosphere } from '@/components/common/DynamicArtworkAtmosphere';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';
import { haptics } from '@/lib/haptics/HapticEngine';
import { getApiUrl } from '@/lib/config/apiConfig';

const fetcher = (url: string) => fetch(getApiUrl(url)).then((res) => res.json()).catch(() => null);

// Icon mapping helper
function renderGenreIcon(iconName: string, className: string = 'w-5 h-5') {
  switch (iconName) {
    case 'Flame': return <Flame className={className} />;
    case 'Mic': return <Mic className={className} />;
    case 'Heart': return <Heart className={className} />;
    case 'Zap': return <Zap className={className} />;
    case 'Activity': return <Activity className={className} />;
    case 'Music2': return <Music2 className={className} />;
    case 'Disc': return <Disc className={className} />;
    case 'Award': return <Award className={className} />;
    case 'Compass': return <Compass className={className} />;
    case 'Sun': return <Sun className={className} />;
    case 'Radio': return <Radio className={className} />;
    case 'Shield': return <Shield className={className} />;
    case 'Layers': return <Layers className={className} />;
    case 'Feather': return <Feather className={className} />;
    case 'Coffee': return <Coffee className={className} />;
    case 'Cloud': return <Cloud className={className} />;
    case 'Volume2': return <Volume2 className={className} />;
    case 'SunMedium': return <SunMedium className={className} />;
    case 'Globe': return <Globe className={className} />;
    case 'Crown': return <Crown className={className} />;
    case 'Film': return <Film className={className} />;
    case 'Tv': return <Tv className={className} />;
    case 'BookOpen': return <BookOpen className={className} />;
    case 'Mic2': return <Mic2 className={className} />;
    case 'Moon': return <Moon className={className} />;
    case 'HeartHandshake': return <HeartHandshake className={className} />;
    case 'Guitar': return <Guitar className={className} />;
    default: return <Sparkles className={className} />;
  }
}

const AVAILABLE_LANGUAGES = [
  'All',
  'Telugu',
  'Hindi',
  'Tamil',
  'Kannada',
  'Malayalam',
  'English',
  'Punjabi',
  'Bengali',
  'Marathi',
];

export function GenresView() {
  const {
    preferredLanguage,
    setActiveTab,
    playSong,
    isPlaying,
    currentSong,
    togglePlayPause,
  } = usePlayerStore();

  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'indian' | 'core' | 'style'>('all');
  const [showAllGenres, setShowAllGenres] = useState(false);

  const selectedGenre = useMemo(() => {
    return selectedGenreId ? getGenreById(selectedGenreId) : null;
  }, [selectedGenreId]);

  // Query calculation for selected genre + language
  const effectiveQuery = useMemo(() => {
    if (!selectedGenre) return '';
    const langPrefix = selectedLanguage !== 'All' ? `${selectedLanguage} ` : (preferredLanguage ? `${preferredLanguage} ` : '');
    return `${langPrefix}${selectedGenre.searchQuery || selectedGenre.name}`;
  }, [selectedGenre, selectedLanguage, preferredLanguage]);

  // SWR fetch for genre songs
  const { data: searchResults, isLoading: isSongsLoading } = useSWR(
    selectedGenre ? `/api/search?q=${encodeURIComponent(effectiveQuery)}&type=songs&limit=35` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const genreSongs: Song[] = useMemo(() => {
    const rawItems = searchResults?.data?.results || searchResults?.data?.songs?.results || [];
    if (!Array.isArray(rawItems)) return [];

    return rawItems.map((s: any) => ({
      id: s.id,
      title: s.name || s.title || 'Unknown Title',
      artist: s.artists?.primary?.[0]?.name || s.artist || 'Various Artists',
      artistId: s.artists?.primary?.[0]?.id || 'unknown',
      album: s.album?.name || s.album || selectedGenre?.name || 'Genre Mix',
      albumId: s.album?.id || 'unknown',
      duration: Number(s.duration) || 210,
      coverUrl: s.image?.find?.((i: any) => i.quality === '500x500')?.url || s.image?.[s.image?.length - 1]?.url || '/app-icon.png',
      audioUrl: s.downloadUrl?.find?.((d: any) => d.quality === '320kbps')?.url || s.downloadUrl?.[s.downloadUrl?.length - 1]?.url || '',
      genre: selectedGenre?.name || 'Various',
      category: 'global_trending' as const,
      releaseYear: Number(s.year || s.releaseYear) || 2024,
      plays: Number(s.playCount || s.plays) || 0,
      likes: Number(s.likes) || 0,
    }));
  }, [searchResults, selectedGenre]);

  // Filtered genre list for index page
  const filteredGenres = useMemo(() => {
    return GENRE_CATALOG.filter((genre) => {
      const matchesSearch = !searchQuery.trim() ||
        genre.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        genre.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = activeCategoryFilter === 'all' || genre.category === activeCategoryFilter;
      const matchesFeatured = showAllGenres || searchQuery.trim().length > 0 || activeCategoryFilter !== 'all' || genre.featured;

      return matchesSearch && matchesCategory && matchesFeatured;
    });
  }, [searchQuery, activeCategoryFilter, showAllGenres]);

  // Action handlers
  const handlePlayAll = (shuffle: boolean = false) => {
    if (genreSongs.length === 0) return;
    haptics.mediumImpact();
    if (shuffle) {
      usePlayerStore.getState().shufflePlay(genreSongs, {
        contextType: 'GENRE',
        contextUri: `raagax:genre:${selectedGenre?.id}`,
        title: `${selectedLanguage !== 'All' ? selectedLanguage + ' ' : ''}${selectedGenre?.name} Mix`,
      });
    } else {
      playSong(genreSongs[0], genreSongs, {
        contextType: 'GENRE',
        contextUri: `raagax:genre:${selectedGenre?.id}`,
        title: `${selectedLanguage !== 'All' ? selectedLanguage + ' ' : ''}${selectedGenre?.name} Mix`,
      });
    }
  };

  // ── DETAIL VIEW (When a Genre is Selected) ────────────────────────────────
  if (selectedGenre) {
    const firstSongCover = genreSongs[0]?.coverUrl;

    return (
      <DynamicArtworkAtmosphere artworkUrl={firstSongCover} isPlaying={isPlaying}>
        <div className="space-y-6 pb-2 text-white select-none animate-in fade-in duration-200">
          {/* Back Navigation Bar */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => {
                setSelectedGenreId(null);
                setSelectedLanguage('All');
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Genres</span>
            </button>

            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              {selectedGenre.category === 'indian' ? 'Indian Genre' : selectedGenre.category === 'style' ? 'Music Style' : 'Global Genre'}
            </span>
          </div>

          {/* Hero Header Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.04] border border-white/10 relative overflow-hidden shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left min-w-0">
              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-white shadow-2xl border border-white/20 flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${selectedGenre.gradient.from}, ${selectedGenre.gradient.to})`,
                  boxShadow: `0 12px 30px ${selectedGenre.gradient.glow}`,
                }}
              >
                {renderGenreIcon(selectedGenre.iconName, 'w-10 h-10')}
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                    RaagaX Soundscape
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight break-words">
                  {selectedLanguage !== 'All' ? `${selectedLanguage} ` : ''}{selectedGenre.name}
                </h1>

                <p className="text-xs sm:text-sm text-slate-300 max-w-xl line-clamp-2 font-medium">
                  {selectedGenre.description}
                </p>
              </div>
            </div>

            {/* Play & Shuffle Actions */}
            <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={() => handlePlayAll(false)}
                disabled={genreSongs.length === 0}
                className="flex-1 sm:flex-none px-6 py-3.5 rounded-full bg-[#FA233B] hover:bg-[#D90429] active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FA233B]/30 transition-all cursor-pointer disabled:opacity-40"
              >
                <Play className="w-4 h-4 fill-white" />
                Play All
              </button>

              <button
                onClick={() => handlePlayAll(true)}
                disabled={genreSongs.length === 0}
                className="flex-1 sm:flex-none px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/15 shadow-md transition-all cursor-pointer disabled:opacity-40"
              >
                <Shuffle className="w-4 h-4 text-slate-200" />
                Shuffle
              </button>
            </div>
          </div>

          {/* ── LANGUAGE FILTER CHIPS (Dimension Separation) ────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#FA233B]" /> Filter By Language
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Combining {selectedGenre.name} with region
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {AVAILABLE_LANGUAGES.map((lang) => {
                const isSelected = selectedLanguage === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => {
                      haptics.lightImpact();
                      setSelectedLanguage(lang);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#FA233B] text-white shadow-lg shadow-[#FA233B]/25 scale-105'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    <span>{lang}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── TRACKS LIST ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-[#FA233B]" /> Top {selectedLanguage !== 'All' ? selectedLanguage : ''} {selectedGenre.name} Tracks
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {genreSongs.length} Tracks
              </span>
            </div>

            {isSongsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-[#FA233B] mb-3" />
                <p className="text-xs font-medium">Gathering {selectedGenre.name} melodies...</p>
              </div>
            ) : genreSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#8E92A4] bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                <Music className="w-12 h-12 mb-3 opacity-40 text-slate-500" />
                <h4 className="text-sm font-bold text-white">No tracks found</h4>
                <p className="text-xs text-[#8E92A4] mt-1">Try selecting a different language or returning to All.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {genreSongs.map((song, index) => {
                  const isCurrentSong = currentSong?.id === song.id;

                  return (
                    <div
                      key={`${song.id}-${index}`}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between group ${
                        isCurrentSong
                          ? 'bg-white/10 border-[#FA233B]/40 shadow-lg'
                          : 'bg-white/[0.03] border-white/5 hover:border-white/15 hover:bg-white/5'
                      }`}
                    >
                      <div
                        onClick={() => playSong(song, genreSongs, {
                          type: 'genre',
                          id: selectedGenre.id,
                          title: `${selectedLanguage !== 'All' ? selectedLanguage + ' ' : ''}${selectedGenre.name}`,
                          name: `${selectedLanguage !== 'All' ? selectedLanguage + ' ' : ''}${selectedGenre.name}`
                        })}
                        className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0"
                      >
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                          className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0 bg-slate-800"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className={`text-xs font-bold truncate ${isCurrentSong ? 'text-[#FA233B]' : 'text-white group-hover:text-[#FA233B]'} transition-colors`}>
                            {song.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <SongActionMenu song={song} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DynamicArtworkAtmosphere>
    );
  }

  // ── MAIN GENRES INDEX VIEW ────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-2 text-white select-none animate-in fade-in duration-200 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">Genres & Styles</h1>
          <p className="text-xs text-[#8E92A4] mt-0.5">Explore music through acoustic spectrum and regional traditions</p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search genres (e.g., Melody, Bollywood)..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#FA233B] transition-all"
          />
        </div>
      </div>

      {/* Category Tabs: All, Indian, Core Global, Styles */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all' as const, label: 'All Categories' },
          { id: 'indian' as const, label: '🇮🇳 Indian Traditions' },
          { id: 'core' as const, label: '🎵 Global Core' },
          { id: 'style' as const, label: '🎬 Styles & Moods' },
        ].map((tab) => {
          const isSelected = activeCategoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                haptics.lightImpact();
                setActiveCategoryFilter(tab.id);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-white text-black shadow-md font-black'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Genres Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {activeCategoryFilter === 'indian' ? 'Indian-Focused Genres' : activeCategoryFilter === 'core' ? 'Global Core Genres' : activeCategoryFilter === 'style' ? 'Acoustic Styles & Moods' : 'Major Genres'} ({filteredGenres.length})
          </span>
          
          {!searchQuery && activeCategoryFilter === 'all' && (
            <button
              onClick={() => setShowAllGenres(!showAllGenres)}
              className="text-xs font-bold text-[#FA233B] hover:underline cursor-pointer"
            >
              {showAllGenres ? 'Show Top 20' : 'View All 50 Genres →'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGenres.map((genre) => (
            <div
              key={genre.id}
              onClick={() => {
                haptics.lightImpact();
                setSelectedGenreId(genre.id);
                setSelectedLanguage('All');
              }}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 hover:bg-white/5 transition-all flex items-center justify-between cursor-pointer group select-none shadow-sm"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-md group-hover:scale-105 transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${genre.gradient.from}, ${genre.gradient.to})`,
                    boxShadow: `0 8px 20px ${genre.gradient.glow}`,
                  }}
                >
                  {renderGenreIcon(genre.iconName, 'w-6 h-6')}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white group-hover:text-[#FA233B] transition-colors truncate">
                    {genre.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {genre.description}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
            </div>
          ))}
        </div>

        {!showAllGenres && !searchQuery && activeCategoryFilter === 'all' && (
          <div className="pt-2 text-center">
            <button
              onClick={() => setShowAllGenres(true)}
              className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 hover:text-white transition-all cursor-pointer shadow-md"
            >
              Explore All 50 Music Genres & Styles →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

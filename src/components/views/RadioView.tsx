'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Radio as RadioIcon,
  Play,
  Signal,
  Users,
  Mic2,
  Sparkles,
  Heart,
  Flame,
  Globe,
  Disc3,
  Waves,
  Moon,
  Zap,
  Music2,
  Headphones,
  Search,
  X,
  Radio,
  RadioTower,
  Sliders,
  Compass,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RadioEngine, RadioType } from '@/lib/radio/RadioEngine';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';
import { Song } from '@/types/music';
import { getApiUrl } from '@/lib/config/apiConfig';
import { RadioStationMetadata } from '@/app/api/radio/stations/route';

const ALL_LANGUAGES = ['Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'Punjabi', 'English', 'Bengali', 'Marathi', 'Bhojpuri', 'All'];

const stationsFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load stations');
  const json = await res.json();
  return (json?.data?.stations as RadioStationMetadata[]) || [];
};

export function RadioView() {
  const { currentSong, playbackContext, preferredLanguage } = usePlayerStore();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return preferredLanguage || 'Telugu';
  });
  const [activeCategory, setActiveCategory] = useState<'all' | 'featured' | 'mood' | 'retro' | 'devotional' | 'dance'>('all');
  const [startingStationId, setStartingStationId] = useState<string | null>(null);

  // Live Radio Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const isRadioPlaying = playbackContext?.type === 'radio' || playbackContext?.contextType === 'RADIO';
  const activeStationId = playbackContext?.id;

  // SWR Dynamic Station Fetching from /api/radio/stations
  const { data: remoteStations, isLoading: isStationsLoading } = useSWR(
    getApiUrl(`/api/radio/stations?language=${encodeURIComponent(selectedLanguage)}`),
    stationsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const displayedStations = useMemo(() => {
    const list = remoteStations || [];
    if (activeCategory === 'all') return list;
    return list.filter((s) => s.category === activeCategory);
  }, [remoteStations, activeCategory]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(getApiUrl(`/api/search/songs?query=${encodeURIComponent(query)}&limit=6`));
      if (res.ok) {
        const json = await res.json();
        const songs = json?.data?.results || json?.data || [];
        setSearchResults(songs);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartStation = async (station: RadioStationMetadata) => {
    haptics.mediumImpact();
    setStartingStationId(station.id);

    await RadioEngine.getInstance().startRadio({
      type: 'genre',
      seedId: station.stationId || station.id,
      seedTitle: station.name,
      seedCover: station.coverUrl,
      language: station.language || selectedLanguage,
    });

    setStartingStationId(null);
  };

  const handleStartSongRadio = async (song?: Song) => {
    const target = song || currentSong;
    if (!target) return;
    haptics.mediumImpact();
    setStartingStationId(`song_${target.id}`);

    await RadioEngine.getInstance().startRadio({
      type: 'song',
      seedId: target.id,
      seedTitle: target.title,
      seedCover: target.coverUrl,
      initialSong: target,
      language: target.language,
    });

    setStartingStationId(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="space-y-8 pb-16 text-white select-none max-w-6xl mx-auto">
      {/* ── 1. HEADER + LIVE STATION SEARCH ── */}
      <div className="space-y-4 pt-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <RadioTower className="w-8 h-8 text-[#FA233B] animate-pulse" />
              RaagaX Web Radio
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
              Endless streaming radio stations powered by JioSaavn WebRadio.
            </p>
          </div>

          {/* Sub-Category Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 self-start overflow-x-auto no-scrollbar max-w-full">
            {[
              { id: 'all', label: 'All Stations' },
              { id: 'featured', label: 'Featured' },
              { id: 'dance', label: 'Dance & Mass' },
              { id: 'mood', label: 'Melody & Chill' },
              { id: 'retro', label: '90s & Retro' },
              { id: 'devotional', label: 'Devotional' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  haptics.lightImpact();
                  setActiveCategory(tab.id as any);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === tab.id
                    ? 'bg-[#FA233B] text-white shadow-[0_2px_10px_rgba(250,35,59,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Interactive Live Radio Search Input ── */}
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search any Song or Artist to start a custom Radio Station..."
              className="w-full bg-white/[0.05] hover:bg-white/[0.08] focus:bg-white/[0.09] text-white placeholder-slate-400 text-xs sm:text-sm pl-10 pr-10 py-3 rounded-2xl border border-white/10 focus:border-[#FA233B]/50 transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-3.5 p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Live Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl bg-[#14151b] border border-white/10 shadow-2xl z-30 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="text-[10px] font-mono font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
                Instant Radio Seeds
              </div>
              {searchResults.map((song) => (
                <div
                  key={`search-res-${song.id}`}
                  onClick={() => handleStartSongRadio(song)}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <OptimizedImage
                      src={song.coverUrl}
                      alt={song.title}
                      size="thumb"
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">{song.artist}</p>
                    </div>
                  </div>
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FA233B] text-white text-[11px] font-bold shadow-md hover:scale-105 active:scale-95 transition-all flex-shrink-0">
                    <Radio className="w-3 h-3" />
                    <span>Start Radio</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Language Bar (JioSaavn /radio/telugu, /hindi style) ── */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
            <Globe className="w-3.5 h-3.5 text-teal-400" /> Language:
          </span>
          {ALL_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang;
            return (
              <button
                key={`lang-filter-${lang}`}
                onClick={() => {
                  haptics.lightImpact();
                  setSelectedLanguage(lang);
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                  isSelected
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-[0_2px_10px_rgba(20,184,166,0.2)]'
                    : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. CURRENT PLAYING SEED HERO ── */}
      {currentSong && (
        <section
          onClick={() => handleStartSongRadio()}
          className="relative rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-[#FA233B]/25 via-red-950/40 to-black/80 border border-[#FA233B]/30 hover:border-[#FA233B]/60 transition-all duration-300 cursor-pointer shadow-[0_10px_40px_rgba(250,35,59,0.15)] group overflow-hidden"
        >
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shadow-2xl flex-shrink-0 border-2 border-white/30 group-hover:scale-105 group-hover:border-[#FA233B] transition-all duration-300">
                <OptimizedImage
                  src={currentSong.coverUrl}
                  alt={currentSong.title}
                  size="thumb"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Waves className="w-6 h-6 text-white animate-pulse" />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono font-black text-[#FA233B] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#FA233B]/20 border border-[#FA233B]/40 inline-flex items-center gap-1 mb-1.5">
                  <Signal className="w-3 h-3 animate-ping" /> SEED SONG RADIO
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight">
                  {currentSong.title} Radio
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Launch a continuous stream inspired by {currentSong.artist} and this track
                </p>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStartSongRadio();
              }}
              className="px-5 py-3 rounded-full bg-[#FA233B] hover:bg-[#e01f34] text-white font-extrabold text-xs flex items-center gap-2 shadow-[0_6px_20px_rgba(250,35,59,0.40)] active:scale-95 transition-transform cursor-pointer flex-shrink-0"
            >
              <Disc3 className="w-4 h-4 animate-spin" />
              <span>Launch Song Radio</span>
            </button>
          </div>
        </section>
      )}

      {/* ── 3. CIRCULAR JIOSAAVN RADIO STATIONS GRID ── */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RadioIcon className="w-5 h-5 text-[#FA233B]" />
            <h2 className="text-xl font-black text-white tracking-tight">
              {selectedLanguage !== 'All' ? `${selectedLanguage} Radio Stations` : 'Top Radio Stations'}
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {displayedStations.length} continuous stations
          </span>
        </div>

        {isStationsLoading && displayedStations.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8 pt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={`skel-radio-${n}`} className="flex flex-col items-center gap-3 animate-pulse">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-white/5 border border-white/10" />
                <div className="w-24 h-3 bg-white/10 rounded-full" />
                <div className="w-16 h-2 bg-white/5 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8 pt-2">
            {displayedStations.map((station) => (
              <CircularStationCard
                key={station.id}
                station={station}
                isLoading={startingStationId === station.id}
                isActive={isRadioPlaying && activeStationId === (station.stationId || station.id)}
                onPlay={() => handleStartStation(station)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Circular / Ring Presentation Station Card Component ───────────────────────
function CircularStationCard({
  station,
  isLoading,
  isActive,
  onPlay,
}: {
  station: RadioStationMetadata;
  isLoading: boolean;
  isActive?: boolean;
  onPlay: () => void;
}) {
  return (
    <div
      onClick={onPlay}
      className="flex flex-col items-center text-center group cursor-pointer transition-all"
    >
      {/* Circular Avatar with Glowing Ring */}
      <div className="relative mb-3">
        <div
          className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full p-1 transition-all duration-300 group-hover:scale-105 ${
            isActive
              ? 'ring-4 ring-[#FA233B] shadow-[0_0_30px_rgba(250,35,59,0.5)]'
              : 'ring-2 ring-white/15 hover:ring-[#FA233B]/70'
          }`}
        >
          <div className="w-full h-full rounded-full overflow-hidden relative shadow-xl">
            <OptimizedImage
              src={station.coverUrl}
              alt={station.name}
              size="thumb"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />

            {/* Dark Hover / Play Overlay */}
            <div
              className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                isActive ? 'opacity-100 bg-black/50' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {isLoading ? (
                <Disc3 className="w-8 h-8 text-white animate-spin" />
              ) : isActive ? (
                <div className="flex items-center gap-1">
                  <span className="w-1 h-5 bg-[#FA233B] rounded-full animate-[pulse_0.4s_infinite_alternate]" />
                  <span className="w-1 h-7 bg-white rounded-full animate-[pulse_0.5s_infinite_alternate_0.1s]" />
                  <span className="w-1 h-4 bg-[#FA233B] rounded-full animate-[pulse_0.45s_infinite_alternate_0.2s]" />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#FA233B] flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                  <Play className="w-5 h-5 fill-white stroke-none ml-0.5 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Active Badge */}
        {isActive && (
          <span className="absolute bottom-0 right-1 px-2 py-0.5 rounded-full bg-[#FA233B] text-white text-[9px] font-mono font-black tracking-wider uppercase shadow-md flex items-center gap-1 border border-black/40">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            LIVE
          </span>
        )}
      </div>

      {/* Station Title & Meta */}
      <h3 className="text-xs sm:text-sm font-black text-white tracking-tight leading-tight line-clamp-1 group-hover:text-[#FA233B] transition-colors w-full px-1">
        {station.name}
      </h3>
      <p className="text-[11px] text-slate-400 font-medium line-clamp-1 mt-0.5 w-full px-1">
        {station.description}
      </p>
      <span className="text-[10px] font-mono font-bold text-slate-500 mt-1 flex items-center gap-1">
        <Users className="w-3 h-3 text-slate-500" />
        {station.listeners.toLocaleString()} listeners
      </span>
    </div>
  );
}

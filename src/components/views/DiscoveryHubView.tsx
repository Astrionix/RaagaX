'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Flame,
  Sparkles,
  Disc3,
  TrendingUp,
  Music,
  Heart,
  Play,
  Pause,
  Download,
  Shuffle,
  Calendar,
  Globe,
  Radio,
  Layers,
  Check,
  ChevronRight,
  TrendingDown,
  Clock,
  Dumbbell,
  Car,
  BookOpen,
  PartyPopper,
  Plane,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';

export type DiscoveryCategory = 'language' | 'new_music' | 'charts' | 'playlists' | 'mood' | 'genres' | 'combinatorial';

interface DiscoveryHubViewProps {
  initialCategory: DiscoveryCategory;
  onBack: () => void;
}

export const ALL_LANGUAGES = [
  { id: 'Telugu', label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { id: 'Hindi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { id: 'Tamil', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { id: 'Kannada', label: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { id: 'Malayalam', label: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { id: 'English', label: 'English', native: 'Global', flag: '🌐' },
  { id: 'Punjabi', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { id: 'Bengali', label: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { id: 'Marathi', label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { id: 'Gujarati', label: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { id: 'Bhojpuri', label: 'Bhojpuri', native: 'भोजपुरी', flag: '🇮🇳' },
];

export const MOODS = [
  { id: 'Romantic', label: 'Romantic', emoji: '❤️', bg: 'from-rose-600 to-pink-900', vibes: ['Soft Melodies', 'Lo-fi Romance', 'Acoustic Love', 'Duets'] },
  { id: 'Chill', label: 'Chill', emoji: '😌', bg: 'from-blue-600 to-slate-900', vibes: ['Lo-fi Beats', 'Acoustic', 'Late Night Relax', 'Peaceful'] },
  { id: 'Happy', label: 'Happy', emoji: '😊', bg: 'from-amber-500 to-yellow-800', vibes: ['Feel Good', 'Sunny Beats', 'Upbeat Grooves', 'Celebration'] },
  { id: 'Late Night', label: 'Late Night', emoji: '🌙', bg: 'from-indigo-900 to-purple-950', vibes: ['Midnight Vibes', 'Slow Melodies', 'Deep Sleep', 'Calm'] },
  { id: 'Sad', label: 'Sad', emoji: '💔', bg: 'from-slate-700 to-zinc-900', vibes: ['Heartbreak', 'Emotional Strings', 'Soulful Sorrow', 'Acoustic'] },
  { id: 'Energetic', label: 'Energy', emoji: '🔥', bg: 'from-orange-600 to-red-900', vibes: ['High Tempo', 'Gym Motivation', 'Fast Beats', 'Power'] },
  { id: 'Peaceful', label: 'Peaceful', emoji: '🧘', bg: 'from-teal-600 to-emerald-950', vibes: ['Meditation', 'Instrumental', 'Nature Vibes', 'Zen'] },
  { id: 'Feel Good', label: 'Feel Good', emoji: '😎', bg: 'from-cyan-600 to-blue-900', vibes: ['Road Trip', 'Carefree', 'Smooth Grooves', 'Vibes'] },
  { id: 'Motivation', label: 'Motivation', emoji: '💪', bg: 'from-red-600 to-rose-950', vibes: ['Workout Fuel', 'Victory Songs', 'Beast Mode', 'Heavy Bass'] },
  { id: 'Party', label: 'Party', emoji: '🎉', bg: 'from-fuchsia-600 to-purple-900', vibes: ['Dance Dhamaka', 'DJ Remixes', 'Club Anthems', 'EDM'] },
];

export const GENRES = [
  { id: 'Melody', label: 'Melody', emoji: '🎼', bg: 'from-red-600 to-rose-900' },
  { id: 'Pop', label: 'Pop', emoji: '🎤', bg: 'from-pink-600 to-purple-900' },
  { id: 'Rock', label: 'Rock', emoji: '🎸', bg: 'from-orange-700 to-stone-900' },
  { id: 'Lo-fi', label: 'Lo-fi', emoji: '🎧', bg: 'from-violet-700 to-indigo-950' },
  { id: 'Folk', label: 'Folk', emoji: '🪕', bg: 'from-amber-600 to-yellow-950' },
  { id: 'Classical', label: 'Classical', emoji: '🎹', bg: 'from-emerald-700 to-teal-950' },
  { id: 'Jazz', label: 'Jazz', emoji: '🎺', bg: 'from-blue-700 to-slate-950' },
  { id: 'Hip-Hop', label: 'Hip-Hop', emoji: '🎵', bg: 'from-cyan-700 to-blue-950' },
  { id: 'Indie', label: 'Indie', emoji: '💿', bg: 'from-fuchsia-700 to-pink-950' },
  { id: 'Devotional', label: 'Devotional', emoji: '🙏', bg: 'from-yellow-600 to-amber-950' },
  { id: 'Film Music', label: 'Film Music', emoji: '🎬', bg: 'from-rose-700 to-red-950' },
];

export function DiscoveryHubView({ initialCategory, onBack }: DiscoveryHubViewProps) {
  const [activeCategory, setActiveCategory] = useState<DiscoveryCategory>(initialCategory);
  const [isLangModalOpen, setIsLangModalOpen] = useState(initialCategory === 'language');
  
  const {
    preferredLanguage = 'Telugu',
    setPreferredLanguage,
    playSong,
    togglePlayPause,
    isPlaying,
    currentSong,
    setSelectedAlbumId,
    setSelectedPlaylistId,
    setActiveTab,
  } = usePlayerStore();

  // New Music State
  const [newMusicSubTab, setNewMusicSubTab] = useState<'all' | 'today' | 'singles' | 'albums' | 'eps' | 'upcoming'>('all');
  const [newMusicData, setNewMusicData] = useState<any>(null);
  const [isLoadingNewMusic, setIsLoadingNewMusic] = useState(false);

  // Charts State
  const [chartsData, setChartsData] = useState<any>(null);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [chartsLanguage, setChartsLanguage] = useState<string>(preferredLanguage);

  // Playlists Hub State
  const [playlistTab, setPlaylistTab] = useState<'for_you' | 'language' | 'activity' | 'time' | 'era'>('for_you');

  // Mood State
  const [selectedMood, setSelectedMood] = useState<string>('Romantic');
  const [moodData, setMoodData] = useState<any>(null);
  const [isLoadingMood, setIsLoadingMood] = useState(false);

  // Genres & Combinatorial State
  const [selectedGenre, setSelectedGenre] = useState<string>('Melody');
  const [combActivity, setCombActivity] = useState<string>('');
  const [genreData, setGenreData] = useState<any>(null);
  const [isLoadingGenre, setIsLoadingGenre] = useState(false);

  // Sync preferredLanguage to chartsLanguage
  useEffect(() => {
    setChartsLanguage(preferredLanguage);
  }, [preferredLanguage]);

  // Fetch New Music
  useEffect(() => {
    if (activeCategory === 'new_music') {
      setIsLoadingNewMusic(true);
      fetch(`/api/home/discovery?type=new_music&lang=${encodeURIComponent(preferredLanguage)}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) setNewMusicData(json.data);
        })
        .catch((e) => console.warn('New music fetch error:', e))
        .finally(() => setIsLoadingNewMusic(false));
    }
  }, [activeCategory, preferredLanguage]);

  // Fetch Charts
  useEffect(() => {
    if (activeCategory === 'charts') {
      setIsLoadingCharts(true);
      fetch(`/api/home/discovery?type=charts&lang=${encodeURIComponent(chartsLanguage)}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) setChartsData(json.data);
        })
        .catch((e) => console.warn('Charts fetch error:', e))
        .finally(() => setIsLoadingCharts(false));
    }
  }, [activeCategory, chartsLanguage]);

  // Fetch Mood Data
  useEffect(() => {
    if (activeCategory === 'mood') {
      setIsLoadingMood(true);
      fetch(`/api/home/discovery?type=mood&lang=${encodeURIComponent(preferredLanguage)}&mood=${encodeURIComponent(selectedMood)}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) setMoodData(json.data);
        })
        .catch((e) => console.warn('Mood fetch error:', e))
        .finally(() => setIsLoadingMood(false));
    }
  }, [activeCategory, preferredLanguage, selectedMood]);

  // Fetch Genre & Combinatorial Data
  useEffect(() => {
    if (activeCategory === 'genres' || activeCategory === 'combinatorial') {
      setIsLoadingGenre(true);
      const url = `/api/home/discovery?type=combinatorial&lang=${encodeURIComponent(preferredLanguage)}&genre=${encodeURIComponent(selectedGenre)}${combActivity ? `&activity=${encodeURIComponent(combActivity)}` : ''}`;
      fetch(url)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) setGenreData(json.data);
        })
        .catch((e) => console.warn('Genre fetch error:', e))
        .finally(() => setIsLoadingGenre(false));
    }
  }, [activeCategory, preferredLanguage, selectedGenre, combActivity]);

  const handleLanguageSelect = (lang: string) => {
    setPreferredLanguage(lang);
    setIsLangModalOpen(false);
    if (activeCategory === 'language') {
      setActiveCategory('new_music');
    }
  };

  const handlePlayAllSongs = (songs: Song[]) => {
    if (!songs || songs.length === 0) return;
    playSong(songs[0], songs);
  };

  return (
    <div className="space-y-6 pb-28 text-white select-none animate-in fade-in duration-200">
      {/* ── TOP NAVIGATION & BREADCRUMB ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Back to Search"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#fa233b] uppercase tracking-wider">
              <span>DISCOVER</span>
              <span>/</span>
              <span>
                {activeCategory === 'new_music' && '✨ New Music'}
                {activeCategory === 'charts' && '📈 Ranked Charts'}
                {activeCategory === 'playlists' && '🎵 Playlists Hub'}
                {activeCategory === 'mood' && '❤️ Mood & Vibes'}
                {activeCategory === 'genres' && '🎸 Genres & Styles'}
                {activeCategory === 'language' && '🗣️ Active Language'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight capitalize mt-0.5">
              {activeCategory === 'new_music' && `New ${preferredLanguage} Music`}
              {activeCategory === 'charts' && `Top Ranked Charts`}
              {activeCategory === 'playlists' && `Curated Playlists & Moods`}
              {activeCategory === 'mood' && `${selectedMood} Vibes`}
              {activeCategory === 'genres' && `${preferredLanguage} • ${selectedGenre}`}
              {activeCategory === 'language' && `Select Active Language`}
            </h1>
          </div>
        </div>

        {/* Global Active Language Indicator Pill */}
        <button
          onClick={() => setIsLangModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#fa233b]/20 to-[#d91c2e]/20 border border-[#fa233b]/40 hover:border-[#fa233b] text-white text-xs font-black shadow-md shadow-red-500/10 active:scale-95 transition-all cursor-pointer w-fit"
          title="Change Music Language"
        >
          <Globe className="w-3.5 h-3.5 text-[#fa233b]" />
          <span>ACTIVE: {preferredLanguage}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300">Switch</span>
        </button>
      </div>

      {/* ── DISCOVERY PILLAR SWITCHER BAR ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {[
          { id: 'new_music', label: 'New Music', emoji: '✨' },
          { id: 'charts', label: 'Charts', emoji: '📈' },
          { id: 'playlists', label: 'Playlists', emoji: '🎵' },
          { id: 'mood', label: 'Mood', emoji: '❤️' },
          { id: 'genres', label: 'Genres & Combinatorial', emoji: '🎸' },
        ].map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#fa233b] to-[#d91c2e] text-white shadow-lg shadow-red-500/25 border border-red-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          PILLAR 2: 🆕 NEW MUSIC (Time-Based: Today, Week, Albums, Singles, EPs)
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeCategory === 'new_music' && (
        <div className="space-y-8">
          {/* Time Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: 'All Releases' },
              { id: 'today', label: '🔥 Released Today' },
              { id: 'singles', label: '🎵 Latest Singles' },
              { id: 'albums', label: '💿 New Albums' },
              { id: 'eps', label: '🎧 New EPs' },
              { id: 'upcoming', label: '📅 Upcoming' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setNewMusicSubTab(st.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  newMusicSubTab === st.id
                    ? 'bg-white text-black font-black'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {isLoadingNewMusic ? (
            <div className="py-24 text-center text-slate-400 space-y-3 flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-[#fa233b] animate-spin" />
              <p className="text-xs font-bold">Scanning time-indexed new releases...</p>
            </div>
          ) : (
            <>
              {/* Section: Released Today */}
              {(newMusicSubTab === 'all' || newMusicSubTab === 'today') && newMusicData?.releasedToday?.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <Flame className="w-4 h-4" /> Released Today ({preferredLanguage})
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {newMusicData.releasedToday.map((item: any) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedAlbumId(item.id);
                          setActiveTab('album');
                        }}
                        className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] hover:border-amber-500/40 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
                      >
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2 bg-slate-900 shadow-md">
                          <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <span className="absolute top-1.5 left-1.5 text-[9px] font-black bg-amber-500 text-black px-1.5 py-0.5 rounded shadow">
                            TODAY
                          </span>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white group-hover:text-amber-400 truncate">{item.title}</h4>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section: New Albums */}
              {(newMusicSubTab === 'all' || newMusicSubTab === 'albums') && newMusicData?.latestAlbums?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Disc3 className="w-4 h-4 text-[#fa233b]" /> Latest Movie Albums & Soundtracks
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                    {newMusicData.latestAlbums.map((item: any) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedAlbumId(item.id);
                          setActiveTab('album');
                        }}
                        className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] hover:border-white/20 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
                      >
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2 bg-slate-900 shadow-md">
                          <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <span className="absolute bottom-1.5 right-1.5 text-[9px] font-black bg-black/70 backdrop-blur text-white px-1.5 py-0.5 rounded">
                            {item.songCount} Songs
                          </span>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white group-hover:text-[#fa233b] truncate">{item.title}</h4>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.artist}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{item.releaseYear || 2026}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Latest Singles */}
              {(newMusicSubTab === 'all' || newMusicSubTab === 'singles') && newMusicData?.latestSingles?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Music className="w-4 h-4 text-[#fa233b]" /> Fresh Singles & Tracks
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {newMusicData.latestSingles.map((item: any) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedAlbumId(item.id);
                          setActiveTab('album');
                        }}
                        className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer group shadow-sm"
                      >
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2 bg-slate-900 shadow-md">
                          <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <span className="absolute top-1.5 left-1.5 text-[9px] font-black bg-[#fa233b] text-white px-1.5 py-0.5 rounded">
                            SINGLE
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white group-hover:text-[#fa233b] truncate">{item.title}</h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.artist}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PILLAR 3: 📈 RANKED CHARTS (Positions #1, #2, Movements ↑ 4, ↓ 2, NEW)
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeCategory === 'charts' && (
        <div className="space-y-6">
          {/* In-Place Language Switcher for Charts */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {ALL_LANGUAGES.map((l) => (
              <button
                key={l.id}
                onClick={() => setChartsLanguage(l.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  chartsLanguage === l.id
                    ? 'bg-gradient-to-r from-[#fa233b] to-[#d91c2e] text-white font-black shadow-md shadow-red-500/25'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <span>{l.flag} {l.label}</span>
              </button>
            ))}
          </div>

          {isLoadingCharts ? (
            <div className="py-24 text-center text-slate-400 space-y-3 flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-[#fa233b] animate-spin" />
              <p className="text-xs font-bold">Fetching ranked chart data for {chartsLanguage}...</p>
            </div>
          ) : chartsData ? (
            <div className="space-y-6">
              {/* Primary Chart Header */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-red-600/20 via-[var(--bg-secondary)] to-black border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-lg flex-shrink-0">
                    <img src={chartsData.primaryChart?.coverUrl} alt="Chart Cover" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-amber-400 tracking-wider uppercase bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      OFFICIAL DAILY RANKING
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                      {chartsData.primaryChart?.title}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Top 50 Most Played & Streamed Tracks in {chartsLanguage}</p>
                  </div>
                </div>

                <button
                  onClick={() => handlePlayAllSongs(chartsData.rankedSongs?.map((r: any) => r.song))}
                  className="px-6 py-3 rounded-full bg-[#fa233b] hover:bg-[#d91c2e] text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-red-500/30 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Play Top 50</span>
                </button>
              </div>

              {/* Ranked Songs Table */}
              <div className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-subtle)] overflow-hidden shadow-sm">
                {chartsData.rankedSongs?.map((item: any) => {
                  const song: Song = item.song;
                  const isCurrent = currentSong?.id === song.id;

                  return (
                    <div
                      key={`${song.id}-${item.rank}`}
                      className={`p-3 sm:px-5 flex items-center justify-between hover:bg-[var(--bg-surface)] transition-colors group cursor-pointer ${
                        isCurrent ? 'bg-red-500/10' : ''
                      }`}
                      onClick={() => playSong(song, chartsData.rankedSongs.map((r: any) => r.song))}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Rank & Movement Delta Badge */}
                        <div className="flex flex-col items-center justify-center min-w-[32px] text-center">
                          <span className={`text-sm font-black ${item.rank <= 3 ? 'text-amber-400' : 'text-slate-400'}`}>
                            #{item.rank}
                          </span>
                          {item.trend === 'UP' && (
                            <span className="text-[9px] font-black text-emerald-400 flex items-center">
                              <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" /> +{item.change}
                            </span>
                          )}
                          {item.trend === 'DOWN' && (
                            <span className="text-[9px] font-black text-rose-400 flex items-center">
                              <TrendingDown className="w-2.5 h-2.5 inline mr-0.5" /> -{item.change}
                            </span>
                          )}
                          {item.trend === 'NEW' && (
                            <span className="text-[8px] font-black text-amber-400 uppercase bg-amber-400/15 px-1 rounded">
                              NEW
                            </span>
                          )}
                        </div>

                        {/* Song Cover & Meta */}
                        <img
                          src={song.coverUrl || '/app-icon.png'}
                          alt={song.title}
                          className="w-11 h-11 rounded-xl object-cover shadow-sm bg-slate-800 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1 pr-2">
                          <h4 className={`text-xs font-bold truncate group-hover:text-[#fa233b] transition-colors ${
                            isCurrent ? 'text-[#fa233b]' : 'text-white'
                          }`}>
                            {song.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                        </div>
                      </div>

                      {/* Right Action Tools */}
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                          {Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}
                        </span>
                        <DownloadStatusIndicator song={song} size="sm" showPercentage />
                        <SongActionMenu song={song} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Other Available Charts */}
              {chartsData.allCharts?.length > 1 && (
                <div className="space-y-3 pt-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    More {chartsLanguage} Official Charts
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                    {chartsData.allCharts.slice(1).map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedPlaylistId(c.id);
                          setActiveTab('playlist');
                        }}
                        className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-white/20 transition-all cursor-pointer group"
                      >
                        <img src={c.coverUrl} alt={c.title} className="w-full aspect-square rounded-xl object-cover mb-2" />
                        <h4 className="text-xs font-bold text-white group-hover:text-[#fa233b] truncate">{c.title}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">{c.subtitle}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PILLAR 4: 🎵 PLAYLISTS DISCOVERY HUB (For You, Activity, Time, Eras)
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeCategory === 'playlists' && (
        <div className="space-y-6">
          {/* Sub Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'for_you', label: '✨ For You' },
              { id: 'activity', label: '🏃 Activity (Gym / Driving / Party)' },
              { id: 'time', label: '🌅 Time of Day (Morning / Late Night)' },
              { id: 'era', label: '⏳ Eras (2000s / 90s / 80s)' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setPlaylistTab(t.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  playlistTab === t.id
                    ? 'bg-white text-black'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Activity Category */}
          {playlistTab === 'activity' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {[
                { title: 'Gym & Workout', desc: `High Energy ${preferredLanguage} Gym Motivation`, icon: Dumbbell, bg: 'from-red-600 to-orange-900', query: `${preferredLanguage} Workout` },
                { title: 'Road Trip & Driving', desc: `Non-Stop ${preferredLanguage} Driving Grooves`, icon: Car, bg: 'from-blue-600 to-indigo-900', query: `${preferredLanguage} Travel` },
                { title: 'Focus & Study', desc: `Instrumental & Lo-fi Concentration`, icon: BookOpen, bg: 'from-purple-600 to-slate-900', query: `${preferredLanguage} Study` },
                { title: 'Party & Dance', desc: `Blockbuster Club & DJ Remixes`, icon: PartyPopper, bg: 'from-pink-600 to-fuchsia-900', query: `${preferredLanguage} Party` },
                { title: 'Chill & Relax', desc: `Soothing Acoustic & Lo-fi Melodies`, icon: Plane, bg: 'from-teal-600 to-emerald-950', query: `${preferredLanguage} Chill` },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedGenre(item.title);
                      setCombActivity(item.title);
                      setActiveCategory('combinatorial');
                    }}
                    className={`p-5 rounded-3xl bg-gradient-to-br ${item.bg} border border-white/15 hover:scale-[1.02] transition-transform cursor-pointer shadow-lg flex flex-col justify-between min-h-[160px]`}
                  >
                    <Icon className="w-8 h-8 text-white opacity-90" />
                    <div>
                      <h4 className="text-base font-black text-white">{item.title}</h4>
                      <p className="text-xs text-white/80 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Time of Day Category */}
          {playlistTab === 'time' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { title: 'Morning Energy', desc: `Peaceful & Uplifting Morning Vibes in ${preferredLanguage}`, icon: Sun, bg: 'from-amber-500 to-orange-800' },
                { title: 'Late Night Chill', desc: `Deep Relaxing Midnight Melodies & Acoustics`, icon: Moon, bg: 'from-indigo-900 to-slate-950' },
                { title: 'Weekend Vibes', desc: `Upbeat Party & Celebration Hits`, icon: Sparkles, bg: 'from-rose-600 to-purple-900' },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedMood(item.title.split(' ')[0]);
                      setActiveCategory('mood');
                    }}
                    className={`p-6 rounded-3xl bg-gradient-to-br ${item.bg} border border-white/15 hover:scale-[1.02] transition-transform cursor-pointer shadow-lg flex flex-col justify-between min-h-[180px]`}
                  >
                    <Icon className="w-10 h-10 text-white" />
                    <div>
                      <h4 className="text-lg font-black text-white">{item.title}</h4>
                      <p className="text-xs text-white/80 mt-1">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Eras Category */}
          {playlistTab === 'era' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {[
                { era: '2020s', title: '2020s Blockbusters', desc: 'Current Decade Megahits' },
                { era: '2010s', title: '2010s Golden Era', desc: 'Anirudh, ARR & DSP Hits' },
                { era: '2000s', title: '2000s Nostalgia', desc: 'Evergreen Melodies' },
                { era: '1990s', title: '90s Classics', desc: 'Vintage Cassette Classics' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedGenre(`${preferredLanguage} ${item.era}`);
                    setActiveCategory('combinatorial');
                  }}
                  className="p-5 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-white/20 transition-all cursor-pointer group shadow-sm text-center space-y-2"
                >
                  <span className="text-2xl font-black text-[#fa233b]">{item.era}</span>
                  <h4 className="text-xs font-bold text-white group-hover:text-[#fa233b] truncate">{item.title}</h4>
                  <p className="text-[11px] text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* For You Standard */}
          {playlistTab === 'for_you' && (
            <div className="p-6 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center space-y-4">
              <Sparkles className="w-8 h-8 text-amber-400 mx-auto animate-pulse" />
              <div>
                <h3 className="text-base font-black text-white">Curated For Your Listening</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Generated in real time using the RaagaX Recommendation Engine for {preferredLanguage} listeners.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedGenre(`${preferredLanguage} Top Hits`);
                  setActiveCategory('combinatorial');
                }}
                className="px-6 py-2.5 rounded-full bg-[#fa233b] text-white font-black text-xs shadow-lg shadow-red-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Generate My Mix
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PILLAR 5: ❤️ MOOD DISCOVERY ENGINE (Sub-Vibes, Mood Queues)
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeCategory === 'mood' && (
        <div className="space-y-6">
          {/* Visual Mood Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {MOODS.map((m) => {
              const isSelected = selectedMood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMood(m.id)}
                  className={`p-4 rounded-2xl bg-gradient-to-br ${m.bg} text-left transition-all cursor-pointer shadow-md flex items-center justify-between border ${
                    isSelected ? 'border-white ring-2 ring-white/30 scale-[1.02]' : 'border-white/10 opacity-85 hover:opacity-100'
                  }`}
                >
                  <div>
                    <span className="text-2xl">{m.emoji}</span>
                    <h4 className="text-sm font-black text-white mt-1">{m.label}</h4>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                </button>
              );
            })}
          </div>

          {/* Sub-Vibes Bar */}
          {(() => {
            const currentMoodObj = MOODS.find((m) => m.id === selectedMood);
            return currentMoodObj?.vibes ? (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-1">Vibe:</span>
                {currentMoodObj.vibes.map((vibe, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedGenre(vibe);
                      setActiveCategory('combinatorial');
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                  >
                    ✦ {vibe}
                  </button>
                ))}
              </div>
            ) : null;
          })()}

          {/* Dynamic Mood Songs */}
          {isLoadingMood ? (
            <div className="py-20 text-center text-slate-400 space-y-3 flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-[#fa233b] animate-spin" />
              <p className="text-xs font-bold">Curating {preferredLanguage} {selectedMood} tracks...</p>
            </div>
          ) : moodData?.songs?.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Top {selectedMood} Hits in {preferredLanguage} ({moodData.songs.length})
                </h3>
                <button
                  onClick={() => handlePlayAllSongs(moodData.songs)}
                  className="px-4 py-1.5 rounded-full bg-[#fa233b] hover:bg-[#d91c2e] text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-red-500/20 active:scale-95 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Play All</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {moodData.songs.map((song: Song, idx: number) => (
                  <div
                    key={`${song.id}-${idx}`}
                    className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-all flex items-center justify-between group shadow-sm cursor-pointer"
                    onClick={() => playSong(song, moodData.songs)}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <img src={song.coverUrl || '/app-icon.png'} alt={song.title} className="w-11 h-11 rounded-xl object-cover bg-slate-800 flex-shrink-0" />
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="text-xs font-bold text-white group-hover:text-[#fa233b] truncate">{song.title}</h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <DownloadStatusIndicator song={song} size="sm" showPercentage />
                      <SongActionMenu song={song} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PILLAR 6: 🎸 GENRES & COMBINATORIAL FILTER ENGINE
      ══════════════════════════════════════════════════════════════════════════ */}
      {(activeCategory === 'genres' || activeCategory === 'combinatorial') && (
        <div className="space-y-6">
          {/* Combinatorial Formula Pill Bar */}
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-wrap items-center gap-2 shadow-sm">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">COMBINATION:</span>
            
            {/* Language Tag */}
            <span className="px-3 py-1 rounded-full bg-[#fa233b]/20 border border-[#fa233b]/40 text-[#fa233b] text-xs font-black">
              🇮🇳 {preferredLanguage}
            </span>

            <span className="text-slate-500 font-bold">+</span>

            {/* Genre Selector */}
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-[#fa233b] cursor-pointer"
            >
              {GENRES.map((g) => (
                <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                  {g.emoji} {g.label}
                </option>
              ))}
            </select>

            {combActivity && (
              <>
                <span className="text-slate-500 font-bold">+</span>
                <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-black flex items-center gap-1">
                  {combActivity}
                  <button onClick={() => setCombActivity('')} className="ml-1 hover:text-white">✕</button>
                </span>
              </>
            )}
          </div>

          {/* Genre Grid Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {GENRES.map((g) => {
              const isSelected = selectedGenre === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGenre(g.id)}
                  className={`p-3.5 rounded-2xl bg-gradient-to-br ${g.bg} text-left transition-all cursor-pointer shadow-md flex items-center justify-between border ${
                    isSelected ? 'border-white ring-2 ring-white/30 scale-[1.02]' : 'border-white/10 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div>
                    <span className="text-xl">{g.emoji}</span>
                    <h4 className="text-xs font-black text-white mt-1">{g.label}</h4>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              );
            })}
          </div>

          {/* Combinatorial Song Results */}
          {isLoadingGenre ? (
            <div className="py-20 text-center text-slate-400 space-y-3 flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-[#fa233b] animate-spin" />
              <p className="text-xs font-bold">Discovering {preferredLanguage} {selectedGenre} tracks...</p>
            </div>
          ) : genreData?.songs?.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  {preferredLanguage} • {selectedGenre} ({genreData.songs.length} Tracks)
                </h3>
                <button
                  onClick={() => handlePlayAllSongs(genreData.songs)}
                  className="px-4 py-1.5 rounded-full bg-[#fa233b] hover:bg-[#d91c2e] text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-red-500/20 active:scale-95 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Play All</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {genreData.songs.map((song: Song, idx: number) => (
                  <div
                    key={`${song.id}-${idx}`}
                    className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-all flex items-center justify-between group shadow-sm cursor-pointer"
                    onClick={() => playSong(song, genreData.songs)}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <img src={song.coverUrl || '/app-icon.png'} alt={song.title} className="w-11 h-11 rounded-xl object-cover bg-slate-800 flex-shrink-0" />
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="text-xs font-bold text-white group-hover:text-[#fa233b] truncate">{song.title}</h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <DownloadStatusIndicator song={song} size="sm" showPercentage />
                      <SongActionMenu song={song} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PILLAR 1: 🗣️ FULL-SCREEN ACTIVE LANGUAGE SELECTOR MODAL
      ══════════════════════════════════════════════════════════════════════════ */}
      {isLangModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-gradient-to-b from-[#1c1d22] to-[#0f1013] border border-white/15 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fa233b] to-[#d91c2e] flex items-center justify-center shadow-lg shadow-red-500/30">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">Select Music Language</h3>
                  <p className="text-xs text-slate-400">Controls New Music, Charts, Trending & Playlists</p>
                </div>
              </div>
              <button
                onClick={() => setIsLangModalOpen(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ALL_LANGUAGES.map((l) => {
                const isSelected = preferredLanguage.toLowerCase() === l.id.toLowerCase();
                return (
                  <button
                    key={l.id}
                    onClick={() => handleLanguageSelect(l.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[85px] ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#fa233b]/20 to-[#d91c2e]/10 border-[#fa233b] ring-2 ring-[#fa233b]/30 shadow-lg shadow-red-500/15'
                        : 'bg-white/5 hover:bg-white/10 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{l.flag}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#fa233b] stroke-[3]" />}
                    </div>
                    <div>
                      <h4 className={`text-sm font-black ${isSelected ? 'text-[#fa233b]' : 'text-white'}`}>{l.label}</h4>
                      <p className="text-[11px] text-slate-400 font-medium">{l.native}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

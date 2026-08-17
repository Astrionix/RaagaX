'use client';

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Clock, 
  Heart, 
  Download, 
  Settings, 
  Disc, 
  Music, 
  ChevronRight, 
  ShieldCheck, 
  Volume2, 
  Sliders, 
  Palette, 
  Shield, 
  Info,
  Sparkles,
  Flame,
  Globe2,
  Trophy,
  Calendar,
  Zap,
  TrendingUp,
  Award,
  Compass,
  Play,
  CheckCircle2
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { useThemeStore } from '@/context/useThemeStore';
import { ListeningAnalyticsEngine, AnalyticsSnapshot, TimeFilterPeriod } from '@/lib/analytics/ListeningAnalyticsEngine';
import { QueueHistory } from '@/lib/queue/QueueHistory';
import { Song } from '@/types/music';

export function ProfileView() {
  const { 
    setActiveTab, 
    toggleSettingsModal, 
    toggleBackupModal,
    streamingQuality,
    setStreamingQuality,
    playSong
  } = usePlayerStore();

  const { user, isLoading: isAuthLoading, setAuthModalOpen } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimeFilterPeriod>('all');
  const [selectedLangName, setSelectedLangName] = useState<string | null>(null);
  const [recentPlayedSongs, setRecentPlayedSongs] = useState<Song[]>([]);
  const [activeTabSub, setActiveTabSub] = useState<'journey' | 'settings'>('journey');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isGuest = isMounted && !user;
  const userName = user ? (user.user_metadata?.full_name || user.email?.split('@')[0] || 'RaagaX Listener') : 'Guest User';
  const userEmail = user ? (user.email || '') : 'Not signed in';
  const initials = user ? (userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U') : 'GU';

  useEffect(() => {
    const load = async () => {
      const data = await ListeningAnalyticsEngine.getInstance().getAnalytics(user?.id || 'guest');
      setAnalytics(data);

      try {
        const historyInstance = QueueHistory.getInstance();
        const entries = await historyInstance.ensureLoaded();
        const seen = new Set<string>();
        const songs: Song[] = [];
        for (let i = entries.length - 1; i >= 0; i--) {
          const s = entries[i].song;
          if (s && !seen.has(s.id)) {
            seen.add(s.id);
            songs.push(s);
          }
          if (songs.length >= 8) break;
        }
        setRecentPlayedSongs(songs);
      } catch {}
    };
    load();
  }, [user?.id]);

  const activeActivity = analytics?.activity[selectedPeriod];
  const selectedLangData = analytics?.languages.find(l => l.name === selectedLangName) || analytics?.languages[0];

  return (
    <div className="space-y-7 pb-28 text-white select-none max-w-5xl mx-auto px-1 sm:px-4">
      
      {/* ======================================================== */}
      {/* 1. REFINED PROFILE HEADER (Rhythm Glass Surface)         */}
      {/* ======================================================== */}
      <section className="p-6 sm:p-7 rounded-3xl glass-deep border border-white/12 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-[0_20px_50px_rgba(0,0,0,0.65)] relative overflow-hidden">
        {/* Subtle Crimson Ambient Refraction */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#E50914]/20 rounded-full blur-3xl pointer-events-none" />
        
        {!isMounted || isAuthLoading ? (
          /* Neutral Loading / Hydration Skeleton */
          <div className="flex items-center gap-5 z-10 animate-pulse w-full max-w-md">
            <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-white/10 flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-white/10 rounded-lg w-40" />
              <div className="h-3.5 bg-white/5 rounded-lg w-28" />
              <div className="h-4 bg-white/5 rounded-full w-32 mt-1" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-5 z-10">
            {user ? (
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-gradient-to-br from-[#FF1E27] to-[#E50914] text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-red-500/35 flex-shrink-0 border-2 border-white/25">
                {initials}
              </div>
            ) : (
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-white/10 text-slate-300 flex items-center justify-center shadow-lg flex-shrink-0 border-2 border-white/15">
                <User className="w-9 h-9 text-slate-300" />
              </div>
            )}
            
            <div className="space-y-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white truncate tracking-tight">{userName}</h1>
              <p className="text-xs font-semibold text-slate-400 truncate">{userEmail}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {user ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#E50914]/18 text-[#FF1E27] text-[10px] font-black uppercase tracking-wider border border-[#E50914]/35 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF1E27] animate-pulse" />
                      RAAGAX • LOSSLESS PRO
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Verified Audiophile</span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-black uppercase tracking-wider border border-white/15 shadow-sm">
                      RAAGAX • GUEST
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Local Session</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mode Switcher & Auth Action */}
        <div className="flex flex-wrap items-center gap-2 z-10 self-start sm:self-center">
          <div className="flex items-center gap-1 p-1 rounded-2xl glass-frosted border border-white/10">
            <button
              onClick={() => setActiveTabSub('journey')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTabSub === 'journey'
                  ? 'bg-[#E50914] text-white shadow-md shadow-red-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Journey</span>
            </button>
            <button
              onClick={() => setActiveTab('recaps')}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-[#fa233b]" />
              <span>Recaps</span>
            </button>
            <button
              onClick={() => setActiveTabSub('settings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTabSub === 'settings'
                  ? 'bg-white/20 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Preferences</span>
            </button>
          </div>

          {user ? (
            <button
              onClick={() => useAuthStore.getState().signOut()}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Sign Out of RaagaX"
            >
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FF1E27] to-[#E50914] hover:opacity-90 shadow-md shadow-red-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Sign In</span>
            </button>
          )}
        </div>
      </section>

      {activeTabSub === 'journey' ? (
        <>
          {/* ======================================================== */}
          {/* 2. PRIMARY LISTENING OVERVIEW CARD                       */}
          {/* ======================================================== */}
          <section className="p-6 sm:p-8 rounded-3xl glass-deep border border-white/12 shadow-2xl relative overflow-hidden space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono font-bold text-[#E50914] uppercase tracking-widest block mb-1">
                  ACOUSTIC OVERVIEW
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Your RaagaX Journey</h2>
              </div>

              {/* 3. TIME FILTER (Week | Month | Year | All Time) */}
              <div className="flex items-center gap-1 p-1 rounded-2xl glass-frosted border border-white/10 self-start">
                {(['week', 'month', 'year', 'all'] as TimeFilterPeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                      selectedPeriod === period
                        ? 'bg-[#E50914] text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {period === 'all' ? 'All Time' : period}
                  </button>
                ))}
              </div>
            </div>

            {/* Dominant Primary Metric */}
            <div className="pt-2">
              <div className="text-4xl sm:text-6xl font-black tracking-tight text-white flex items-baseline gap-3">
                <span>{activeActivity?.periodTotalDisplay || analytics?.overview.totalListeningDisplay}</span>
                <span className="text-xs sm:text-sm font-bold text-[#FF1E27] uppercase tracking-wider font-mono">
                  TOTAL LISTENING TIME
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {activeActivity?.growthComparisonText}
              </p>
            </div>

            {/* Triad Metric Counter Grid */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/8">
              <div className="p-4 rounded-2xl glass-frosted border border-white/5 text-center">
                <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {analytics?.overview.songsPlayedCount.toLocaleString()}
                </p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Songs Played
                </p>
              </div>

              <div className="p-4 rounded-2xl glass-frosted border border-white/5 text-center">
                <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {analytics?.overview.uniqueArtistsCount}
                </p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Artists Explored
                </p>
              </div>

              <div className="p-4 rounded-2xl glass-frosted border border-white/5 text-center">
                <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {analytics?.overview.uniqueAlbumsCount}
                </p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Albums Completed
                </p>
              </div>
            </div>

            {/* 4. SOPHISTICATED LISTENING ACTIVITY GRAPH */}
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="uppercase tracking-wider font-mono text-[10px]">Listening Momentum Activity</span>
                <span className="text-white font-mono">{activeActivity?.periodLabel}</span>
              </div>

              {/* Dynamic Responsive Bar Graph */}
              <div className="h-36 sm:h-44 w-full flex items-end gap-2 sm:gap-4 pt-4 pb-2 px-2 bg-white/[0.02] rounded-2xl border border-white/5 relative">
                {(!activeActivity?.bars || activeActivity.bars.length === 0) ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <Clock className="w-6 h-6 text-slate-500 mb-1 animate-pulse" />
                    <p className="text-xs font-bold text-white">Your RaagaX Journey Starts Here</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Play songs to build your personalized acoustic timeline</p>
                  </div>
                ) : (
                  activeActivity.bars.map((bar, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-8 bg-[#161618] border border-white/20 text-white text-[10px] font-mono px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-20 whitespace-nowrap">
                        {bar.hours} hrs
                      </div>

                      {/* Bar Pillar */}
                      <div className="w-full max-w-[38px] rounded-t-xl overflow-hidden bg-white/5 relative flex items-end" style={{ height: '100%' }}>
                        <div 
                          className={`w-full rounded-t-xl transition-all duration-700 ${
                            bar.isPeak 
                              ? 'bg-gradient-to-t from-[#E50914] to-[#FF1E27] shadow-[0_0_15px_rgba(229,9,20,0.5)]' 
                              : 'bg-gradient-to-t from-white/20 to-white/40 group-hover:from-[#E50914]/60 group-hover:to-[#FF1E27]/80'
                          }`}
                          style={{ height: `${Math.max(12, bar.percentage)}%` }}
                        />
                      </div>

                      {/* Label */}
                      <span className="text-[10px] font-mono font-bold text-slate-400 mt-2 truncate w-full text-center">
                        {bar.label}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ======================================================== */}
          {/* 5. YOUR MUSIC DNA                                        */}
          {/* ======================================================== */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#E50914]" /> YOUR MUSIC DNA
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Algorithmic Affinity Profile</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl glass-frosted border border-white/10 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Artist</p>
                <h4 className="text-base sm:text-lg font-black text-white truncate">{analytics?.dna.topArtist}</h4>
                <p className="text-[11px] text-[#FF1E27] font-semibold">{analytics?.dna.topArtistPlays} plays recorded</p>
              </div>

              <div className="p-4 rounded-2xl glass-frosted border border-white/10 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Album</p>
                <h4 className="text-base sm:text-lg font-black text-white truncate">{analytics?.dna.topAlbum}</h4>
                <p className="text-[11px] text-slate-400 truncate">{analytics?.dna.topAlbumArtist}</p>
              </div>

              <div className="p-4 rounded-2xl glass-frosted border border-white/10 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Most Played Song</p>
                <h4 className="text-base sm:text-lg font-black text-white truncate">{analytics?.dna.mostPlayedSong}</h4>
                <p className="text-[11px] text-slate-400 truncate">{analytics?.dna.mostPlayedSongArtist}</p>
              </div>

              <div className="p-4 rounded-2xl glass-frosted border border-white/10 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dominant Genre</p>
                <h4 className="text-base sm:text-lg font-black text-white truncate">{analytics?.dna.topGenre}</h4>
                <p className="text-[11px] text-slate-400">92% affinity score</p>
              </div>

              <div className="p-4 rounded-2xl glass-frosted border border-white/10 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Core Language</p>
                <h4 className="text-base sm:text-lg font-black text-white truncate">{analytics?.dna.topLanguage}</h4>
                <p className="text-[11px] text-[#FF1E27] font-semibold">Primary native stream</p>
              </div>

              <div className="p-4 rounded-2xl glass-frosted border border-white/10 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peak Listening Time</p>
                <h4 className="text-base sm:text-lg font-black text-white truncate">{analytics?.dna.peakTimeRange}</h4>
                <p className="text-[11px] text-slate-400">Late night melody zone</p>
              </div>
            </div>
          </section>

          {/* ======================================================== */}
          {/* 6. LISTENING HABITS & DISCOVERY STATS (2-Col Grid)       */}
          {/* ======================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Listening Habits */}
            <div className="p-5 sm:p-6 rounded-3xl glass-deep border border-white/10 space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" /> YOUR LISTENING HABITS
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Daily Average</p>
                  <p className="text-base font-black text-white mt-0.5">{analytics?.habits.averageDailyTime}</p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Avg Session</p>
                  <p className="text-base font-black text-white mt-0.5">{analytics?.habits.averageSessionDuration}</p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Longest Run</p>
                  <p className="text-base font-black text-[#FF1E27] mt-0.5">{analytics?.habits.longestSessionDuration}</p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Peak Day</p>
                  <p className="text-base font-black text-white mt-0.5">{analytics?.habits.mostActiveDayOfWeek}</p>
                </div>
              </div>
            </div>

            {/* Discovery Statistics */}
            <div className="p-5 sm:p-6 rounded-3xl glass-deep border border-white/10 space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-400" /> YOUR DISCOVERY
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xl font-black text-sky-400">+{analytics?.discovery.newSongsDiscovered}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">New Songs Found</p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xl font-black text-emerald-400">+{analytics?.discovery.newArtistsDiscovered}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">New Artists</p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xl font-black text-purple-400">+{analytics?.discovery.newAlbumsDiscovered}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">New Albums</p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xl font-black text-amber-400">{analytics?.discovery.languagesExplored}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Languages Explored</p>
                </div>
              </div>
            </div>

          </div>

          {/* ======================================================== */}
          {/* 7. LANGUAGES YOU LISTEN TO (Multilingual Spectrum)       */}
          {/* ======================================================== */}
          <section className="p-6 rounded-3xl glass-deep border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[#E50914]" /> LANGUAGES YOU LISTEN TO
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Tap language for deep stats</span>
            </div>

            <div className="space-y-3">
              {analytics?.languages.map((lang) => (
                <div 
                  key={lang.name}
                  onClick={() => setSelectedLangName(lang.name)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    (selectedLangName === lang.name || (!selectedLangName && lang.name === 'Telugu'))
                      ? 'bg-white/[0.08] border-[#E50914]/40 shadow-lg'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-white">{lang.name}</span>
                    <span className="font-mono text-[#FF1E27]">{lang.percentage}% ({lang.hoursListened}h)</span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#E50914] to-[#FF1E27] rounded-full transition-all duration-700" 
                      style={{ width: `${lang.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Language Micro-Inspect Card */}
            {selectedLangData && (
              <div className="p-4 rounded-2xl bg-[#161618] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Focused Insight: {selectedLangData.name}</span>
                  <p className="font-bold text-white mt-0.5">{selectedLangData.songsPlayed.toLocaleString()} tracks played • Top Artist: <span className="text-[#FF1E27]">{selectedLangData.topArtist}</span></p>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Top Album: {selectedLangData.topAlbum}</span>
              </div>
            )}
          </section>

          {/* ======================================================== */}
          {/* 8. LISTENING MILESTONES & PERSONAL RECORDS               */}
          {/* ======================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Milestones */}
            <div className="p-5 sm:p-6 rounded-3xl glass-deep border border-white/10 space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" /> YOUR MILESTONES
              </h3>

              <div className="space-y-2.5">
                {analytics?.milestones.map((m) => (
                  <div key={m.id} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-white">{m.title}</span>
                        {m.completed ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                            Completed ✓
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[9px] font-bold border border-amber-500/20">
                            In Progress
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{m.targetMetric}</p>
                    </div>

                    {!m.completed && m.remainingText && (
                      <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{m.remainingText}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Personal Records */}
            <div className="p-5 sm:p-6 rounded-3xl glass-deep border border-white/10 space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-[#E50914]" /> PERSONAL RECORDS
              </h3>

              <div className="space-y-2.5">
                {analytics?.records.map((r, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{r.label}</p>
                      <h4 className="text-xs sm:text-sm font-black text-white truncate mt-0.5">{r.value}</h4>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">{r.detail}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ======================================================== */}
          {/* 9. RECENTLY PLAYED QUICK SHELF                           */}
          {/* ======================================================== */}
          {recentPlayedSongs.length > 0 && (
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E50914]" /> RECENTLY PLAYED
                </h3>
                <button 
                  onClick={() => setActiveTab('library')}
                  className="text-xs font-bold text-[#FF1E27] hover:underline"
                >
                  View Library →
                </button>
              </div>

              <div className="divide-y divide-white/5 glass-frosted rounded-2xl border border-white/10 overflow-hidden shadow-lg">
                {recentPlayedSongs.map((song) => (
                  <div 
                    key={song.id} 
                    onClick={() => playSong(song, recentPlayedSongs)}
                    className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img src={song.coverUrl} alt={song.title} className="w-11 h-11 rounded-xl object-cover shadow-sm flex-shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">{song.title}</h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">Recently Played</span>
                      <button className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-[#E50914] text-white flex items-center justify-center transition-all">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        /* ======================================================== */
        /* SETTINGS & PREFERENCES TAB (Combined You & Settings)    */
        /* ======================================================== */
        <section className="space-y-4">
          <div className="p-6 rounded-3xl glass-deep border border-white/10 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Audio & Playback Preferences</h3>
            
            <div className="divide-y divide-white/5 glass-frosted rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setActiveTab('settings')}
                className="w-full py-4 px-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3.5">
                  <Settings className="w-5 h-5 text-[#E50914]" />
                  <div>
                    <span className="text-sm font-bold text-white block">Full App Settings</span>
                    <span className="text-[11px] text-slate-400">Equalizer, crossfade, gesture navigation & connected devices</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              <div className="py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <Volume2 className="w-5 h-5 text-indigo-400" />
                  <div>
                    <span className="text-sm font-bold text-white block">Streaming Quality</span>
                    <span className="text-[11px] text-slate-400">Lossless Master Audio Delivery</span>
                  </div>
                </div>
                <select
                  value={streamingQuality}
                  onChange={(e) => setStreamingQuality(e.target.value as any)}
                  className="bg-[#202024] border border-white/15 text-white text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-red-500"
                >
                  <option value="LOW">Eco (96 kbps)</option>
                  <option value="MEDIUM">Standard (160 kbps)</option>
                  <option value="HIGH">High (320 kbps)</option>
                  <option value="LOSSLESS">Lossless (FLAC 24-bit)</option>
                </select>
              </div>

              <button
                onClick={toggleBackupModal}
                className="w-full py-4 px-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="text-sm font-bold text-white block">Backup & Cloud Sync</span>
                    <span className="text-[11px] text-slate-400">Cross-device history backup and restore</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

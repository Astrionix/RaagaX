'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Clock, Sparkles, Flame, Play, Music, Disc, User, 
  Globe2, Download, Radio, RotateCcw, FastForward, Shield, ArrowLeft,
  ChevronRight, CheckCircle2, TrendingUp, Calendar, Zap, Layers
} from 'lucide-react';
import { 
  ListeningAnalyticsEngine, 
  AnalyticsSnapshot, 
  InsightsTimeRange 
} from '@/lib/analytics/ListeningAnalyticsEngine';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';

const TIME_RANGES: { id: InsightsTimeRange; label: string }[] = [
  { id: '7days', label: '7 Days' },
  { id: '30days', label: '30 Days' },
  { id: '3months', label: '3 Months' },
  { id: '6months', label: '6 Months' },
  { id: '1year', label: '1 Year' },
  { id: 'all', label: 'All Time' },
];

export function InsightsView() {
  const { playSong, setActiveTab, setSelectedArtistId } = usePlayerStore();
  const { user } = useAuthStore();

  const [selectedRange, setSelectedRange] = useState<InsightsTimeRange>('30days');
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    ListeningAnalyticsEngine.getInstance()
      .getAnalytics(user?.id || 'guest', selectedRange)
      .then(snapshot => {
        if (isMounted) {
          setData(snapshot);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [selectedRange, user?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-white">
        <div className="w-10 h-10 border-4 border-[#FA233B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const overview = data?.overview;
  const dna = data?.dna;
  const weekday = data?.weekdayActivity || [];
  const topSongs = data?.topSongs || [];
  const topArtists = data?.topArtists || [];
  const topAlbums = data?.topAlbums || [];
  const languages = data?.languages || [];
  const genres = data?.genres || [];
  const offlineVsStream = data?.offlineVsStreamed;
  const mostReplayed = data?.mostReplayed || [];
  const mostSkipped = data?.mostSkipped || [];

  return (
    <div className="space-y-8 pb-2 text-white select-none relative animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#FA233B]/20 border border-[#FA233B]/30 text-[10px] font-black uppercase tracking-wider text-[#FA233B] flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> Music Insights
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Your Music Journey</h1>
          <p className="text-xs text-slate-400 mt-0.5">Authoritative analytics based on your real playback activity</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => usePlayerStore.getState().toggleWrappedModal(true)}
            className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#FA233B] to-purple-600 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-red-500/25 hover:scale-105 transition-transform cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>2026 Wrapped</span>
          </button>

          {/* Time Range Selector Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white/[0.04] p-1 rounded-2xl border border-white/10">
            {TIME_RANGES.map(range => (
              <button
                key={range.id}
                onClick={() => setSelectedRange(range.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                  selectedRange === range.id
                    ? 'bg-[#FA233B] text-white shadow-md shadow-red-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 4 Metric Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Total Listening Time */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#FA233B]/20 via-white/[0.03] to-white/[0.01] border border-[#FA233B]/30 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#FA233B]">Listening Time</span>
            <Flame className="w-4 h-4 text-[#FA233B]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {overview?.totalListeningDisplay || '0m'}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {overview?.completionRatePercentage || 85}% completion rate
          </p>
        </div>

        {/* 2. Songs Played */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.03] border border-white/10 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Songs Played</span>
            <Music className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {overview?.songsPlayedCount || 0}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Across {overview?.uniqueArtistsCount || 0} unique artists
          </p>
        </div>

        {/* 3. Top Language */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.03] border border-white/10 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Top Language</span>
            <Globe2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-white truncate">
            {dna?.topLanguage || 'Telugu'}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {languages[0]?.percentage || 100}% of listening time
          </p>
        </div>

        {/* 4. Top Artist */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.03] border border-white/10 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Top Artist</span>
            <User className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-white truncate">
            {dna?.topArtist || 'Various'}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {dna?.topArtistPlays || 0} total plays
          </p>
        </div>
      </div>

      {/* Weekday Activity Rhythm & Time of Day */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekday Activity Bar Chart (Mon - Sun) */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white/[0.02] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FA233B]" /> Listening Rhythm
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Hours listened by day of week</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
              Peak: {data?.habits.mostActiveDayOfWeek}
            </span>
          </div>

          <div className="space-y-2.5 pt-2">
            {weekday.map(item => (
              <div key={item.day} className="flex items-center gap-3">
                <span className={`w-8 text-xs font-mono font-bold ${item.isPeak ? 'text-[#FA233B]' : 'text-slate-400'}`}>
                  {item.day}
                </span>
                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden relative">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.isPeak 
                        ? 'bg-gradient-to-r from-[#FA233B] to-purple-600' 
                        : 'bg-white/20 group-hover:bg-white/30'
                    }`}
                    style={{ width: `${Math.max(item.percentage, item.hours > 0 ? 8 : 2)}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs font-mono text-slate-300 font-bold">
                  {item.hoursDisplay}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Time of Day Distribution */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.02] border border-white/10 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" /> Active Hours
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Peak listening window: {dna?.peakTimeRange}</p>
          </div>

          <div className="space-y-3 pt-2">
            {(data?.timeOfDay || []).map(slot => (
              <div key={slot.slot} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-300">{slot.label} <span className="text-[10px] text-slate-500">({slot.timeRange})</span></span>
                  <span className="text-white font-mono font-bold">{slot.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" 
                    style={{ width: `${slot.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offline vs Streamed Breakdown */}
      {offlineVsStream && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-white/[0.02] to-blue-500/10 border border-white/10 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" /> Downloaded vs Streamed
            </h3>
            <p className="text-xs text-slate-400">
              {offlineVsStream.offlineHours}h offline ({offlineVsStream.offlinePercentage}%) • {offlineVsStream.streamedHours}h streamed ({offlineVsStream.streamedPercentage}%)
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-64">
            <div className="flex-1 h-3.5 bg-white/10 rounded-full overflow-hidden flex shadow-inner">
              <div 
                className="h-full bg-emerald-500 flex items-center justify-center text-[8px] font-black text-slate-950" 
                style={{ width: `${Math.max(offlineVsStream.offlinePercentage, 10)}%` }}
                title="Downloaded"
              >
                {offlineVsStream.offlinePercentage}%
              </div>
              <div 
                className="h-full bg-blue-500 flex items-center justify-center text-[8px] font-black text-white" 
                style={{ width: `${Math.max(offlineVsStream.streamedPercentage, 10)}%` }}
                title="Streamed"
              >
                {offlineVsStream.streamedPercentage}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Songs & Top Artists Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Played Songs */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.02] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Music className="w-4 h-4 text-[#FA233B]" /> Most Played Songs
            </h3>
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Top {topSongs.length}</span>
          </div>

          {topSongs.length > 0 ? (
            <div className="space-y-2">
              {topSongs.slice(0, 5).map((item, idx) => (
                <div
                  key={item.song.id || idx}
                  onClick={() => playSong(item.song, topSongs.map(t => t.song))}
                  className="p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-4 text-center font-mono font-black text-xs text-slate-500 group-hover:text-[#FA233B]">
                      {idx + 1}
                    </span>
                    <img 
                      src={item.song.coverUrl || '/app-icon.png'} 
                      alt={item.song.title} 
                      className="w-10 h-10 rounded-xl object-cover shadow bg-slate-800 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                        {item.song.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">{item.song.artist}</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-mono font-black text-white block">{item.plays} plays</span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.durationDisplay}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">No track plays recorded yet</p>
          )}
        </div>

        {/* Top Artists */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.02] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" /> Top Artists
            </h3>
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Top {topArtists.length}</span>
          </div>

          {topArtists.length > 0 ? (
            <div className="space-y-2">
              {topArtists.slice(0, 5).map((artist, idx) => (
                <div
                  key={artist.name}
                  className="p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-4 text-center font-mono font-black text-xs text-slate-500">
                      {idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FA233B] to-purple-600 flex items-center justify-center text-xs font-black text-white shadow flex-shrink-0">
                      {artist.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {artist.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">{artist.durationDisplay} total time</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-mono font-black text-emerald-400 block">{artist.plays} plays</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">No artist plays recorded yet</p>
          )}
        </div>
      </div>

      {/* Replayed vs Skipped Behavioral Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Most Replayed */}
        <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider text-purple-400">
            <RotateCcw className="w-3.5 h-3.5" /> Most Replayed Songs
          </h3>
          {mostReplayed.length > 0 ? (
            <div className="space-y-1.5">
              {mostReplayed.slice(0, 3).map(r => (
                <div key={r.song.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-300 truncate max-w-[200px]">{r.song.title}</span>
                  <span className="text-purple-300 font-mono font-bold">{r.replayCount} loops</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">No replay loops recorded</p>
          )}
        </div>

        {/* Most Skipped */}
        <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider text-amber-400">
            <FastForward className="w-3.5 h-3.5" /> Most Skipped Songs
          </h3>
          {mostSkipped.length > 0 ? (
            <div className="space-y-1.5">
              {mostSkipped.slice(0, 3).map(s => (
                <div key={s.song.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-300 truncate max-w-[200px]">{s.song.title}</span>
                  <span className="text-amber-400 font-mono font-bold">{s.skipCount} skips</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">Zero skipped tracks</p>
          )}
        </div>
      </div>

      {/* Privacy Notice Card */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-400">
            Your listening data stays private to your device & account. You can pause or clear history anytime in <span className="text-white font-bold">Settings → Privacy</span>.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('settings')}
          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all flex-shrink-0"
        >
          Privacy Settings
        </button>
      </div>
    </div>
  );
}

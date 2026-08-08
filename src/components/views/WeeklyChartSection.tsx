'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Play, Pause, TrendingUp, TrendingDown, Minus, Flame, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

type ChartLanguage = 'Telugu' | 'Kannada' | 'Tamil' | 'Hindi' | 'Malayalam' | 'English';

interface ChartSong {
  rank?: number;
  previousRank?: number | null;
  rankChange?: number | null;
  isNew: boolean;
  songId: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  audioUrl: string;
  duration: number;
  sourceId: string;
  matchConfidence: number;
  status: string;
  playable: boolean;
}

interface ChartData {
  chart: { name: string; language: string; weekLabel: string; weekStart: string; weekEnd: string } | null;
  songs: ChartSong[];
  newReleases: ChartSong[];
}

const LANGUAGES: ChartLanguage[] = ['Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English'];

function toSong(e: ChartSong, language: ChartLanguage): Song {
  return {
    id: e.songId, title: e.title, artist: e.artist, artistId: '', album: e.album, albumId: '',
    duration: e.duration, coverUrl: e.artwork, audioUrl: e.audioUrl,
    genre: `${language.toUpperCase()} HITS`, category: 'latest_telugu',
    releaseYear: new Date().getFullYear(), plays: 0, likes: 0, downloads: 0,
    audioQuality: '24-bit FLAC', bitrate: '320 kbps', sampleRate: '48 kHz', codec: 'AAC HQ Stream',
    lyrics: [], credits: { composer: e.artist, lyricist: '', singers: [e.artist], label: '' },
  };
}

function RankBadge({ e }: { e: ChartSong }) {
  if (e.isNew && !e.rank) return <span className="text-[9px] font-black text-emerald-400 uppercase">NEW</span>;
  if (!e.rankChange) return <Minus className="w-3 h-3 text-slate-600" />;
  if (e.rankChange > 0) return (
    <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-400">
      <TrendingUp className="w-3 h-3" />{e.rankChange}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[9px] font-black text-red-400">
      <TrendingDown className="w-3 h-3" />{Math.abs(e.rankChange)}
    </span>
  );
}

function SongRow({ e, language, isCurrent, isPlaying, onPlay }: {
  e: ChartSong; language: ChartLanguage; isCurrent: boolean; isPlaying: boolean; onPlay: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-colors group cursor-pointer ${isCurrent ? 'bg-[#EF233C]/10 border border-[#EF233C]/30' : 'hover:bg-[#1C1C1E]'}`}
      onClick={onPlay}>
      {e.rank !== undefined && (
        <div className="w-6 text-center flex-shrink-0">
          <span className={`text-sm font-black ${isCurrent ? 'text-[#EF233C]' : 'text-slate-500'}`}>{e.rank}</span>
        </div>
      )}
      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
        <img src={e.artwork} alt={e.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isCurrent && isPlaying
            ? <Pause className="w-4 h-4 fill-white text-white" />
            : <Play className="w-4 h-4 fill-white text-white ml-0.5" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-[#EF233C]' : 'text-white'}`}>{e.title}</h4>
        <p className="text-[10px] text-slate-400 truncate mt-0.5">{e.artist}</p>
      </div>
      {e.rank !== undefined && (
        <div className="flex-shrink-0 w-8 flex justify-end">
          <RankBadge e={e} />
        </div>
      )}
      {e.isNew && e.rank === undefined && (
        <span className="text-[9px] font-black text-emerald-400 flex-shrink-0">NEW</span>
      )}
    </div>
  );
}

export function WeeklyChartSection() {
  const { playSong, currentSong, isPlaying, preferredLanguage, setPreferredLanguage } = usePlayerStore();
  const activeLang = preferredLanguage as ChartLanguage;
  
  const [data, setData] = useState<ChartData | null>(null);
  const [status, setStatus] = useState<'loading' | 'updating' | 'ready' | 'stale' | 'error'>('loading');
  const maxUpdatingDuration = 30000; // 30 seconds max for updating status

  const fetchChart = useCallback(async (lang: ChartLanguage, isPolling = false) => {
    if (!isPolling) setStatus('loading'); 
    try {
      const res = await fetch(`/api/charts?language=${lang}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      
      if (json.success) {
        // If we are polling and it's still updating, don't overwrite existing stale data with nulls
        if (isPolling && json.status === 'updating' && data?.songs?.length) return;
        
        setData(json.data);
        setStatus(json.status); // 'ready', 'stale', 'updating', 'error'
      } else {
        if (!isPolling) setStatus('error');
      }
    } catch { 
      if (!isPolling) setStatus('error'); 
    }
  }, [data]);

  useEffect(() => { fetchChart(activeLang); }, [activeLang]);

  // Handle polling and timeout for 'updating' state
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let pollInterval: NodeJS.Timeout;

    if (status === 'updating') {
      pollInterval = setInterval(() => {
        fetchChart(activeLang, true);
      }, 5000);

      timeout = setTimeout(() => {
        if (data?.songs?.length) {
            setStatus('stale');
        } else {
            setStatus('error');
        }
      }, 45000); // 45 seconds max for the background worker
    }
    
    return () => {
      clearTimeout(timeout);
      clearInterval(pollInterval);
    };
  }, [status, data, activeLang, fetchChart]);

  const handlePlay = (entry: ChartSong, allEntries: ChartSong[]) => {
    const song = toSong(entry, activeLang);
    const queue = allEntries.filter(e => e.playable).map(e => toSong(e, activeLang));
    playSong(song, queue);
  };

  const chartSongs = data?.songs ?? [];
  const newReleases = data?.newReleases ?? [];

  return (
    <div className="space-y-8">
      {/* ── Weekly Top 10 ── */}
      <section className="space-y-4 w-full overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#EF233C]" /> This Week&apos;s Top 10
          </h2>
          {data?.chart && (
            <span className="text-[10px] text-slate-500 font-mono hidden sm:block">
              {data.chart.weekStart} – {data.chart.weekEnd}
            </span>
          )}
        </div>

        {/* Language pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full">
          {LANGUAGES.map(lang => (
            <button key={lang} onClick={() => setPreferredLanguage(lang)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 transition-all ${activeLang === lang ? 'bg-[#EF233C] text-white' : 'bg-[#26262A] text-slate-400 hover:text-white'}`}>
              {lang}
            </button>
          ))}
        </div>

        {/* States Handling */}
        {status === 'loading' && (
          <div className="space-y-2">{Array.from({length:5}).map((_,i) => <div key={i} className="h-14 rounded-xl bg-[#1C1C1E] animate-pulse" />)}</div>
        )}

        {status === 'updating' && !chartSongs.length && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4 bg-[#1C1C1E] rounded-xl border border-white/5">
            <RefreshCw className="w-6 h-6 text-[#EF233C] animate-spin" />
            <div className="text-center">
              <p className="text-sm font-bold text-white">Updating this week&apos;s chart...</p>
              <p className="text-xs text-slate-500 mt-1">This takes a few seconds.</p>
            </div>
            <button onClick={() => fetchChart(activeLang)} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold transition-colors">
              Refresh
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-3 bg-[#1C1C1E] rounded-xl border border-red-500/20">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <p className="text-sm font-bold text-white">Chart temporarily unavailable.</p>
            {chartSongs.length > 0 && <p className="text-xs text-slate-500">Your previous chart will appear below.</p>}
            <button onClick={() => fetchChart(activeLang)} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold transition-colors mt-2">
              Retry
            </button>
          </div>
        )}

        {/* Render Chart (for ready, stale, or updating if we have stale cache) */}
        {(status === 'ready' || status === 'stale' || (status === 'updating' && chartSongs.length > 0) || (status === 'error' && chartSongs.length > 0)) && (
          <div className="space-y-1">
            {status === 'stale' && (
              <div className="flex items-center justify-between px-2 py-1.5 mb-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <span className="text-[10px] text-yellow-500 font-bold">Showing previous chart</span>
                <button onClick={() => fetchChart(activeLang)} className="flex items-center gap-1 text-[10px] font-bold text-yellow-500 hover:text-yellow-400">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            )}
            {status === 'updating' && chartSongs.length > 0 && (
               <div className="flex items-center justify-between px-2 py-1.5 mb-2 bg-[#EF233C]/10 border border-[#EF233C]/20 rounded-lg">
                 <span className="text-[10px] text-[#EF233C] font-bold flex items-center gap-1">
                   <RefreshCw className="w-3 h-3 animate-spin" /> Updating in background...
                 </span>
                 <button onClick={() => fetchChart(activeLang)} className="text-[10px] font-bold text-white/50 hover:text-white">Refresh</button>
               </div>
            )}
            
            {chartSongs.map(entry => (
              <SongRow key={entry.songId} e={entry} language={activeLang}
                isCurrent={currentSong?.id === entry.songId}
                isPlaying={isPlaying}
                onPlay={() => handlePlay(entry, chartSongs)} />
            ))}
          </div>
        )}
      </section>

      {/* ── New Releases ── */}
      {newReleases.length > 0 && (status === 'ready' || status === 'stale') && (
        <section className="space-y-4">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" /> New Releases
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {newReleases.slice(0, 10).map(entry => (
              <SongRow key={entry.songId} e={entry} language={activeLang}
                isCurrent={currentSong?.id === entry.songId}
                isPlaying={isPlaying}
                onPlay={() => handlePlay(entry, newReleases)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

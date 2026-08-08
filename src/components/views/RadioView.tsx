'use client';

import React from 'react';
import { Radio as RadioIcon, Play, Signal, Users } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
const LIVE_RADIO_STATIONS = [
  { id: 'r1', name: 'Telugu Melodies 24/7', genre: 'Sid Sriram & Melody FM', frequency: '98.3 FM', listeners: 142000, coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80', audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3' },
  { id: 'r2', name: 'Bollywood Hits Radio', genre: 'Arijit Singh & Pritam FM', frequency: '104.0 FM', listeners: 289000, coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80', audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=energy-10499.mp3' },
  { id: 'r3', name: 'Mass Beats & Party FM', genre: 'High Energy Anthems', frequency: '93.5 FM', listeners: 98000, coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80', audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73373.mp3?filename=pop-beat-110298.mp3' }
];

export function RadioView() {
  const { playSong } = usePlayerStore();

  return (
    <div className="space-y-8 pb-6 text-white select-none">
      <div className="space-y-2 pt-1">
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <RadioIcon className="w-7 h-7 text-[#EF233C] animate-pulse" /> RaagaX Live Radio Broadcasts
        </h1>
        <p className="text-xs text-slate-400">24/7 Lossless Live Telugu & Global FM Streams</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {LIVE_RADIO_STATIONS.map((station) => (
          <div
            key={station.id}
            onClick={() => {
              playSong({
                id: station.id,
                title: station.name,
                artist: station.genre,
                artistId: 'r',
                album: 'Live Radio',
                albumId: 'r',
                duration: 3600,
                coverUrl: station.coverUrl,
                audioUrl: station.audioUrl,
                genre: 'Live FM',
                category: 'radio',
                releaseYear: 2026,
                plays: station.listeners,
                likes: 12000,
                audioQuality: '24-bit FLAC',
              });
            }}
            className="p-5 rounded-2xl surface-card surface-card-hover space-y-4 cursor-pointer group"
          >
            <div className="relative w-full h-44 rounded-xl overflow-hidden shadow-lg">
              <img src={station.coverUrl} alt={station.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute top-3 left-3 bg-[#EF233C] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                <Signal className="w-3 h-3 animate-ping" /> LIVE {station.frequency}
              </div>
              <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md text-white text-[9px] font-mono px-2 py-0.5 rounded-md font-bold border border-white/20">
                24-bit FLAC
              </div>
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-10 h-10 fill-white text-white ml-0.5" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-white group-hover:text-[#EF233C] transition-colors">
                {station.name}
              </h3>
              <p className="text-xs text-slate-400 font-medium">{station.genre}</p>
              <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-500" /> {station.listeners.toLocaleString()} listeners
                </span>
                <span>• India</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

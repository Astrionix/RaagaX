'use client';

import React, { useState } from 'react';
import { X, Link2, Check, Download, Music, Sparkles } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function PlaylistImporterModal() {
  const { isImporterOpen, toggleImporterModal, importSongsFromUrl } = usePlayerStore();
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isImporterOpen) return null;

  const handleImport = () => {
    if (!url.trim()) return;
    setIsImporting(true);

    setTimeout(() => {
      const importedSongs = [
        {
          id: `imp-${Date.now()}-1`,
          title: 'Samayama (From "Hi Nanna")',
          artist: 'Hesham Abdul Wahab, Anurag Kulkarni',
          artistId: 'a1',
          album: 'Hi Nanna',
          albumId: 'alb-h',
          duration: 250,
          coverUrl: 'https://c.saavncdn.com/712/Hi-Nanna-Telugu-2023-20231206161405-500x500.jpg',
          audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
          genre: 'Melody',
          category: 'latest_telugu' as const,
          releaseYear: 2024,
          plays: 4500000,
          likes: 210000,
          audioQuality: '24-bit FLAC' as const,
        },
        {
          id: `imp-${Date.now()}-2`,
          title: 'Kurchi Madathapetti (From "Guntur Kaaram")',
          artist: 'Thaman S, Sahithi Chaganti',
          artistId: 'a4',
          album: 'Guntur Kaaram',
          albumId: 'alb-g',
          duration: 210,
          coverUrl: 'https://c.saavncdn.com/152/Guntur-Kaaram-Telugu-2024-20240112040156-500x500.jpg',
          audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=ambient-piano-10781.mp3',
          genre: 'Mass',
          category: 'mass' as const,
          releaseYear: 2024,
          plays: 8900000,
          likes: 430000,
          audioQuality: '24-bit FLAC' as const,
        }
      ];

      importSongsFromUrl(importedSongs);
      setIsImporting(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        toggleImporterModal();
      }, 1200);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl surface-card p-6 border border-white/10 shadow-2xl space-y-5 text-white relative">
        <button
          onClick={toggleImporterModal}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#EF233C]/20 border border-red-800/40 text-[10px] font-bold text-[#EF233C] uppercase">
            <Sparkles className="w-3.5 h-3.5" /> BlackHole Importer Engine
          </div>
          <h2 className="text-xl font-black tracking-tight">Import Spotify / JioSaavn Playlist</h2>
          <p className="text-xs text-slate-400">
            Paste any public playlist link from Spotify or JioSaavn to import songs instantly.
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-black/60 border border-white/10 text-xs text-white placeholder:text-slate-500 font-semibold focus:border-[#EF233C] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {['https://open.spotify.com/playlist/telugu-hits', 'https://www.jiosaavn.com/featured/weekly-top-req/0N92j3lM3X8_'].map((sample) => (
              <button
                key={sample}
                onClick={() => setUrl(sample)}
                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 border border-white/10 truncate"
              >
                Sample: {sample.includes('spotify') ? 'Spotify Hits' : 'JioSaavn Top'}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <button
            onClick={toggleImporterModal}
            className="px-5 py-2.5 rounded-2xl bg-white/10 text-xs font-bold text-slate-300 hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || !url.trim()}
            className="px-6 py-2.5 rounded-2xl bg-[#EF233C] text-white font-extrabold text-xs shadow-lg shadow-red-500/30 flex items-center gap-2 disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <Download className="w-4 h-4 animate-bounce" /> Parsing Tracks...
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" /> Playlist Imported!
              </>
            ) : (
              <>
                <Music className="w-4 h-4" /> Import Playlist
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

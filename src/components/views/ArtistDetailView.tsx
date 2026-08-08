'use client';

import React from 'react';
import { Play, Heart, Download, Music, ArrowLeft, Disc, Users, ShieldCheck, Check } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';

export function ArtistDetailView() {
  const { selectedArtistId, setSelectedArtistId, setActiveTab, playSong, likedSongIds, toggleLikeSong, downloadedSongIds, toggleDownloadSong, queue } = usePlayerStore();
  const [isFollowing, setIsFollowing] = React.useState(false);

  const artist = POPULAR_ARTISTS.find((a) => a.id === selectedArtistId) || POPULAR_ARTISTS[0];

  const artistSongs = queue.filter((s) => s.artistId === artist.id || s.artist.toLowerCase().includes(artist.name.toLowerCase()));
  const artistAlbums: any[] = [];

  return (
    <div className="space-y-8 pb-6 text-white select-none">
      {/* Back Button */}
      <button
        onClick={() => {
          setSelectedArtistId(null);
          setActiveTab('home');
        }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-300 hover:text-white transition-all"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </button>

      {/* Artist Hero Banner */}
      <section className="relative rounded-2xl bg-gradient-to-r from-slate-950 via-[#121622] to-slate-900 p-6 sm:p-10 overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6 z-10 text-center md:text-left">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-2xl border-4 border-white/20 flex-shrink-0">
            <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EF233C]/20 border border-red-800/40 text-[10px] font-bold uppercase text-[#EF233C]">
              <ShieldCheck className="w-3 h-3 text-[#EF233C]" /> Verified Maestro
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">{artist.name}</h1>
            <p className="text-xs text-slate-300 font-medium">
              <Users className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
              {(artist.monthlyListeners / 1000000).toFixed(1)}M Monthly Listeners • {artist.genres.join(' • ')}
            </p>

            <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
              <button
                onClick={() => artistSongs.length > 0 && playSong(artistSongs[0], artistSongs)}
                className="px-6 py-2.5 rounded-full bg-[#EF233C] text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-red-500/30"
              >
                <Play className="w-4 h-4 fill-white" /> Play Top Hits
              </button>
              <button
                onClick={() => setIsFollowing(!isFollowing)}
                className={`px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 border transition-all ${
                  isFollowing
                    ? 'bg-white/20 text-white border-white/40'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                }`}
              >
                {isFollowing ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Top Popular Tracks */}
      <section className="space-y-4">
        <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
          <Music className="w-5 h-5 text-[#EF233C]" /> Popular Songs
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {artistSongs.map((song) => {
            const isLiked = likedSongIds.includes(song.id);
            const isDownloaded = downloadedSongIds.includes(song.id);

            return (
              <div
                key={song.id}
                className="p-3.5 rounded-2xl surface-card surface-card-hover flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => playSong(song, artistSongs)}>
                  <img src={song.coverUrl} alt={song.title} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-[#EF233C] transition-colors truncate max-w-[200px]">
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">{song.album}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => toggleLikeSong(song.id)} title="Like Song">
                    <Heart className={`w-4 h-4 ${isLiked ? 'text-[#EF233C] fill-[#EF233C]' : 'text-slate-400 hover:text-[#EF233C]'}`} />
                  </button>
                  <button onClick={() => toggleDownloadSong(song.id)} title="Download Offline">
                    <Download className={`w-4 h-4 ${isDownloaded ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`} />
                  </button>
                  <button
                    onClick={() => playSong(song, artistSongs)}
                    className="p-2 rounded-xl bg-[#EF233C] text-white shadow-md hover:scale-105 transition-transform"
                  >
                    <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Albums & Discography */}
      {artistAlbums.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            <Disc className="w-5 h-5 text-[#EF233C]" /> Discography
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {artistAlbums.map((alb) => (
              <div
                key={alb.id}
                className="p-4 rounded-2xl surface-card surface-card-hover space-y-3 cursor-pointer group"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden shadow-md relative">
                  <img src={alb.coverUrl} alt={alb.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-[#EF233C]">{alb.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{alb.releaseYear} • {alb.songIds.length} Songs</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

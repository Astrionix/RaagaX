'use client';

import React, { useMemo } from 'react';
import useSWR from 'swr';
import { Play, Heart, Download, Music, ArrowLeft, Disc, Users, ShieldCheck, Check } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ArtistDetailView() {
  const { 
    selectedArtistId, 
    setSelectedArtistId, 
    setActiveTab, 
    setSelectedAlbumId,
    playSong, 
    likedSongIds, 
    toggleLikeSong, 
    downloadedSongIds, 
    toggleDownloadSong,
    preferredLanguage
  } = usePlayerStore();
  
  const [isFollowing, setIsFollowing] = React.useState(false);

  const { data, error, isLoading } = useSWR(
    selectedArtistId ? `/api/artists/${selectedArtistId}?songCount=20&albumCount=20` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const artist = data?.data;

  // Multilingual discovery pipeline: Preferred language first -> Retain other languages -> Deduplicate -> Map to Song type
  const artistSongs = useMemo(() => {
    if (!artist?.topSongs) return [];

    const preferred = artist.topSongs.filter((s: any) =>
      s.language?.toLowerCase() === preferredLanguage.toLowerCase() ||
      s.genre?.toLowerCase().includes(preferredLanguage.toLowerCase())
    );
    const others = artist.topSongs.filter((s: any) =>
      s.language?.toLowerCase() !== preferredLanguage.toLowerCase() &&
      !s.genre?.toLowerCase().includes(preferredLanguage.toLowerCase())
    );

    const combined = [...preferred, ...others];
    const seenIds = new Set<string>();
    const unique = combined.filter((s: any) => {
      if (!s.id || seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    }).slice(0, 20);

    return unique.map((s: any) => ({
      id: s.id,
      title: s.name || s.title || 'Unknown',
      artist: s.artists?.primary?.[0]?.name || artist.name,
      artistId: s.artists?.primary?.[0]?.id || artist.id,
      album: s.album?.name || '',
      albumId: s.album?.id || '',
      duration: Number(s.duration) || 210,
      coverUrl: s.image?.find?.((i: any) => i.quality === '500x500')?.url || s.image?.[s.image?.length - 1]?.url || artist.image?.[0]?.url || '',
      audioUrl: s.downloadUrl?.find?.((d: any) => d.quality === '320kbps')?.url || s.downloadUrl?.[s.downloadUrl?.length - 1]?.url || '',
      genre: s.genre || s.language || 'Music',
      category: 'global_trending' as const,
      releaseYear: Number(s.year || s.releaseYear) || 2024,
      plays: Number(s.playCount || s.plays) || 0,
      likes: Number(s.likes) || 0
    }));
  }, [artist, preferredLanguage]);

  const artistAlbums = useMemo(() => {
    if (!artist?.topAlbums) return [];

    const preferred = artist.topAlbums.filter((a: any) =>
      a.language?.toLowerCase() === preferredLanguage.toLowerCase() ||
      a.genre?.toLowerCase() === preferredLanguage.toLowerCase()
    );
    const others = artist.topAlbums.filter((a: any) =>
      a.language?.toLowerCase() !== preferredLanguage.toLowerCase() &&
      a.genre?.toLowerCase() !== preferredLanguage.toLowerCase()
    );

    const combined = [...preferred, ...others];
    const seenIds = new Set<string>();
    const unique = combined.filter((a: any) => {
      if (!a.id || seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    }).slice(0, 20);

    return unique.map((a: any) => ({
      id: a.id,
      title: a.name || a.title || 'Unknown',
      coverUrl: a.image?.find?.((i: any) => i.quality === '500x500')?.url || a.image?.[a.image?.length - 1]?.url || '',
      releaseYear: a.year || a.releaseYear || '',
      trackCount: a.songCount || a.trackCount || 0
    }));
  }, [artist, preferredLanguage]);

  if (isLoading) {
    return (
      <div className="space-y-8 pb-6 text-white p-6 animate-pulse">
         <div className="h-40 bg-white/5 rounded-2xl w-full" />
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/5 rounded-2xl" />)}
         </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="p-10 text-center text-white">
        <h2 className="text-xl font-bold">Failed to load artist</h2>
        <button onClick={() => setActiveTab('home')} className="mt-4 px-4 py-2 bg-white/10 rounded-full">Go Back</button>
      </div>
    );
  }

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
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Artist Hero Banner */}
      <section className="relative rounded-2xl bg-gradient-to-r from-slate-950 via-[#121622] to-slate-900 p-6 sm:p-10 overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6 z-10 text-center md:text-left">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-2xl border-4 border-white/20 flex-shrink-0">
            <img src={artist.imageUrl || artist.image?.find?.((i: any) => i.quality === '500x500')?.url || artist.image?.[artist.image?.length - 1]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819'} alt={artist.name} className="w-full h-full object-cover bg-slate-800" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fa233b]/20 border border-[#fa233b]/40 text-[10px] font-bold uppercase text-[#fa233b]">
              <ShieldCheck className="w-3 h-3 text-[#fa233b]" /> {artist.isVerified ? 'Verified Maestro' : 'Artist'}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">{artist.name}</h1>
            <p className="text-xs text-slate-300 font-medium">
              <Users className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
              {(artist.followerCount / 1000000).toFixed(1)}M Followers
            </p>

            <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
              <button
                onClick={() => artistSongs.length > 0 && playSong(artistSongs[0], artistSongs)}
                className="px-6 py-2.5 rounded-full bg-[#fa233b] text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-red-500/30"
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
      {artistSongs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            <Music className="w-5 h-5 text-[#fa233b]" /> Popular Songs ({preferredLanguage})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {artistSongs.map((song: any) => {
              const isLiked = likedSongIds.includes(song.id);
              const isDownloaded = downloadedSongIds.includes(song.id);

              return (
                <div
                  key={song.id}
                  className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0" onClick={() => playSong(song, artistSongs)}>
                    <img src={song.coverUrl} alt={song.title} className="w-12 h-12 rounded-xl object-cover shadow-sm bg-slate-800" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white group-hover:text-[#fa233b] transition-colors truncate">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">{song.album || song.artist || artist.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={() => toggleLikeSong(song.id)} title="Like Song">
                      <Heart className={`w-4 h-4 ${isLiked ? 'text-[#fa233b] fill-[#fa233b]' : 'text-slate-400 hover:text-[#fa233b]'}`} />
                    </button>
                    <button onClick={() => toggleDownloadSong(song.id)} title="Download Offline">
                      <Download className={`w-4 h-4 ${isDownloaded ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`} />
                    </button>
                    <button
                      onClick={() => playSong(song, artistSongs)}
                      className="p-2 rounded-xl bg-[#fa233b] text-white shadow-md hover:scale-105 transition-transform opacity-0 group-hover:opacity-100"
                    >
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Albums & Discography */}
      {artistAlbums.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            <Disc className="w-5 h-5 text-[#fa233b]" /> Discography ({preferredLanguage})
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {artistAlbums.map((alb: any) => (
              <div
                key={alb.id}
                onClick={() => {
                  setSelectedAlbumId(alb.id);
                  setActiveTab('album');
                }}
                className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all space-y-3 cursor-pointer group"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden shadow-md relative bg-slate-800">
                  <img src={alb.coverUrl} alt={alb.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-[#fa233b]">{alb.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{alb.releaseYear} • {alb.trackCount} Songs</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

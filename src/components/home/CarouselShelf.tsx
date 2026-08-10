import React, { useState } from 'react';
import { ShelfItem } from '@/types/home';
import { Play, ChevronRight, ChevronDown, X, Shuffle, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';

export function CarouselShelf({ title, items, icon, showPlayAll }: { title: string; items: ShelfItem[]; icon?: React.ReactNode; showPlayAll?: boolean }) {
  const { setActiveTab, setSelectedPlaylistId, setSelectedArtistId, setSelectedAlbumId, playSong, currentSong, isPlaying } = usePlayerStore();
  const [showAll, setShowAll] = useState(false);

  const handleItemClick = (item: ShelfItem) => {
    if (item.type === 'playlist' || item.type === 'mix') {
      setSelectedPlaylistId(item.id);
      setActiveTab('playlist');
    } else if (item.type === 'artist') {
      setSelectedArtistId(item.id);
    } else if (item.type === 'album') {
      setSelectedAlbumId(item.id);
      setSelectedPlaylistId(`album:${item.id}`);
      setActiveTab('playlist');
    } else if (item.type === 'song') {
      const rawSongs = items.map(i => i.rawItem).filter(Boolean);
      playSong(item.rawItem || (item as any), rawSongs.length > 0 ? rawSongs : (items as any[]));
    }
  };

  const handleQuickPlay = async (e: React.MouseEvent, item: ShelfItem) => {
    e.stopPropagation();
    
    if (item.type === 'song') {
      const rawSongs = items.map(i => i.rawItem).filter(Boolean);
      playSong(item.rawItem || (item as any), rawSongs.length > 0 ? rawSongs : (items as any[]));
      return;
    }

    try {
      // Create a temporary loading state by animating the button or something if needed
      const btn = e.currentTarget as HTMLButtonElement;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<svg class="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
      
      const { RealMusicEngine } = await import('@/lib/realMusicEngine');
      const engine = RealMusicEngine.getInstance();
      
      let songs: any[] = [];
      if (item.type === 'playlist' || item.type === 'mix') {
        const details = await engine.getPlaylistDetails(item.id);
        songs = details?.songs || [];
      } else if (item.type === 'album') {
        const details = await engine.getPlaylistDetails('album:' + item.id);
        songs = details?.songs || [];
      } else if (item.type === 'artist') {
        // Fallback for artist if we want to support it later, but RealMusicEngine doesn't have it yet
        songs = [];
      }

      if (songs.length > 0) {
        playSong(songs[0], songs);
      }
      
      // Restore icon if it didn't play (or it played successfully)
      btn.innerHTML = originalHtml;
    } catch (err) {
      console.error('Failed to quick play:', err);
    }
  };

  const handlePlayAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (items.length === 0) return;

    const btn = e.currentTarget as HTMLButtonElement;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<svg class="animate-spin w-4 h-4 text-[#fa233b]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

    try {
      if (items[0].type === 'song') {
        const rawSongs = items.map(i => i.rawItem).filter(Boolean);
        if (rawSongs.length > 0) {
          playSong(rawSongs[0] as any, rawSongs as any[]);
        }
      } else {
        // For albums/playlists, just quick play the first one to avoid massive API spam
        const { RealMusicEngine } = await import('@/lib/realMusicEngine');
        const engine = RealMusicEngine.getInstance();
        let songs: any[] = [];
        
        if (items[0].type === 'playlist' || items[0].type === 'mix') {
          const details = await engine.getPlaylistDetails(items[0].id);
          songs = details?.songs || [];
        } else if (items[0].type === 'album') {
          const details = await engine.getPlaylistDetails('album:' + items[0].id);
          songs = details?.songs || [];
        }

        if (songs.length > 0) {
          playSong(songs[0], songs);
        }
      }
    } catch (err) {
      console.error('Failed to play all:', err);
    } finally {
      btn.innerHTML = originalHtml;
    }
  };

  const handleShufflePlayAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (items.length === 0) return;

    try {
      if (items[0].type === 'song') {
        const rawSongs = items.map(i => i.rawItem).filter(Boolean);
        if (rawSongs.length > 0) {
          const randomIndex = Math.floor(Math.random() * rawSongs.length);
          usePlayerStore.getState().setRemoteState({ isShuffle: true });
          playSong(rawSongs[randomIndex] as any, rawSongs as any[]);
        }
      }
    } catch (err) {
      console.error('Failed to shuffle play all:', err);
    }
  };

  const uniqueItems = items.filter((item, index, self) =>
    index === self.findIndex((t) => t.title === item.title)
  );

  const visibleItems = showAll ? uniqueItems : uniqueItems.slice(0, 10);
  const totalSongs = uniqueItems.length;

  const formatTime = (s: number) => {
    if (!s) return '3:42'; // fallback
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const totalDurationSec = uniqueItems.reduce((acc, item) => acc + (item.type === 'song' ? (item.rawItem?.duration || 0) : 0), 0);
  const totalDurationHrs = Math.floor(totalDurationSec / 3600);
  const totalDurationMins = Math.floor((totalDurationSec % 3600) / 60);
  const durationText = totalDurationHrs > 0 ? `${totalDurationHrs} hr ${totalDurationMins} min` : `${totalDurationMins} min`;

  const coverImageUrl = items[0]?.imageUrl || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300';

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-xl font-bold text-white hover:underline cursor-pointer inline-block">
            {title}
          </h2>
          {showPlayAll && items.length > 0 && (
            <button 
              onClick={handlePlayAll}
              className="ml-2 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors group flex items-center justify-center"
              title="Play All"
            >
              <Play className="w-4 h-4 fill-[#fa233b] text-[#fa233b] group-hover:scale-110 transition-transform ml-0.5" />
            </button>
          )}
        </div>
        {items.length > 10 && (
          <button 
            onClick={() => setShowAll(true)}
            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            See All
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      
      <div className="grid grid-rows-2 auto-cols-[144px] sm:auto-cols-[176px] grid-flow-col overflow-x-auto no-scrollbar gap-4 pb-4">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            onClick={() => handleItemClick(item)}
            className={`group glass-card p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer w-full`}
          >
            <div className="relative w-full aspect-square mb-3 shadow-lg rounded-md overflow-hidden bg-slate-800">
              <img
                src={item.imageUrl || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300'}
                alt={item.title}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300';
                }}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                  item.type === 'artist' ? 'rounded-full' : 'rounded-md'
                }`}
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <button 
                onClick={(e) => handleQuickPlay(e, item)}
                className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#fa233b] flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
              >
                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
              </button>
            </div>
            <h3 className="font-bold text-sm text-white truncate">{item.title}</h3>
            {item.subtitle && item.subtitle !== 'Unknown' && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {showAll && (
        <div className="fixed inset-0 z-50 bg-[#121212] flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          {/* Header Gradient Background */}
          <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#fa233b]/40 to-[#121212] pointer-events-none opacity-50" />
          
          {/* Close Button */}
          <button 
            onClick={() => setShowAll(false)} 
            className="absolute top-4 right-4 sm:top-6 sm:right-8 p-2 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-colors z-10 cursor-pointer"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="flex-1 overflow-y-auto pb-safe scroll-smooth">
            {/* Spotify-style Hero Section */}
            <div className="relative pt-20 pb-6 px-4 sm:px-8 max-w-[1920px] mx-auto flex flex-col sm:flex-row items-start sm:items-end gap-6 mt-safe">
              <img 
                src={coverImageUrl} 
                alt={title}
                className="w-48 h-48 sm:w-60 sm:h-60 shadow-2xl object-cover rounded-md flex-shrink-0 bg-slate-800 self-center sm:self-auto"
              />
              <div className="flex flex-col gap-2 pb-2 w-full">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Playlist</span>
                <h1 className="text-3xl sm:text-6xl md:text-8xl font-black text-white tracking-tight leading-tight sm:leading-none mb-2 sm:mb-4 flex flex-wrap items-center gap-3">
                  {title}
                  {title.toLowerCase().includes('releases') && (
                    <span className="px-3 py-1 rounded-full bg-blue-500 text-xs sm:text-sm font-black tracking-wider uppercase text-white shadow-lg shadow-blue-500/30">NEW</span>
                  )}
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-300 mt-1 sm:mt-2">
                  <span className="font-bold text-white">RaagaX</span>
                  <span className="hidden sm:inline">•</span>
                  <span>{totalSongs} songs,</span>
                  <span className="text-slate-400">{durationText}</span>
                </div>
              </div>
            </div>

            {/* Action Bar Background Overlay (appears on scroll ideally, but static here for simplicity) */}
            <div className="bg-black/20 backdrop-blur-3xl border-b border-white/5 sticky top-0 z-10">
              <div className="max-w-[1920px] mx-auto px-4 sm:px-8 py-4 flex items-center gap-6">
                <button 
                  onClick={handlePlayAll}
                  className="w-14 h-14 rounded-full bg-[#fa233b] hover:bg-[#fa233b]/90 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all group"
                >
                  <Play className="w-7 h-7 fill-white ml-1 group-hover:scale-105 transition-transform" />
                </button>
                <button 
                  onClick={handleShufflePlayAll}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                  title="Shuffle Play"
                >
                  <Shuffle className="w-8 h-8" />
                </button>
                <button className="p-2 text-slate-400 hover:text-white transition-colors">
                  <MoreHorizontal className="w-8 h-8" />
                </button>
              </div>

              {/* Table Header */}
              <div className="max-w-[1920px] mx-auto px-4 sm:px-8 py-2 grid grid-cols-[40px_minmax(0,1fr)_40px] md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_100px] gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 sticky top-[88px] bg-[#121212]/95 backdrop-blur-xl z-10">
                <div className="text-center">#</div>
                <div>Title</div>
                <div className="hidden md:block">Album</div>
                <div className="hidden md:block">Date added</div>
                <div className="text-right pr-4">
                  <svg role="img" height="16" width="16" aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className="inline-block"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"></path><path d="M8 3.25a.75.75 0 0 1 .75.75v3.25H11a.75.75 0 0 1 0 1.5H7.25V4A.75.75 0 0 1 8 3.25z"></path></svg>
                </div>
              </div>
            </div>

            {/* Modal Track List */}
            <div className="max-w-[1920px] mx-auto px-4 sm:px-8 py-4 pb-8">
              {uniqueItems.map((item, idx) => {
                const isCurrentlyPlaying = currentSong?.id === item.id;
                
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`group grid grid-cols-[40px_minmax(0,1fr)_40px] md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_100px] gap-4 items-center p-2 rounded-md hover:bg-white/10 transition-colors cursor-pointer ${isCurrentlyPlaying ? 'bg-white/5' : ''}`}
                  >
                    <div className="flex justify-center relative">
                      {isCurrentlyPlaying && isPlaying ? (
                        <div className="flex items-end gap-0.5 h-4 w-4">
                          <div className="w-1 bg-[#fa233b] rounded-t-sm animate-[bounce_1s_infinite_100ms] h-full"></div>
                          <div className="w-1 bg-[#fa233b] rounded-t-sm animate-[bounce_1s_infinite_300ms] h-3/4"></div>
                          <div className="w-1 bg-[#fa233b] rounded-t-sm animate-[bounce_1s_infinite_500ms] h-1/2"></div>
                        </div>
                      ) : (
                        <>
                          <span className={`text-sm font-medium ${isCurrentlyPlaying ? 'text-[#fa233b]' : 'text-slate-400'} group-hover:invisible`}>
                            {idx + 1}
                          </span>
                          <button 
                            onClick={(e) => handleQuickPlay(e, item)}
                            className="absolute inset-0 flex items-center justify-center invisible group-hover:visible"
                          >
                            <Play className="w-4 h-4 fill-white text-white" />
                          </button>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={item.imageUrl || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300'} alt={item.title} className="w-10 h-10 object-cover bg-slate-800" />
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-base font-normal truncate ${isCurrentlyPlaying ? 'text-[#fa233b]' : 'text-white'}`}>
                          {item.title}
                        </h4>
                        {item.subtitle && (
                          <p className="text-sm font-normal text-slate-400 truncate hover:underline">{item.subtitle}</p>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:block min-w-0">
                      <span className="text-sm text-slate-400 truncate hover:underline block">
                        {item.type === 'song' ? (item.rawItem?.album || item.title) : item.title}
                      </span>
                    </div>

                    <div className="hidden md:block min-w-0">
                      <span className="text-sm text-slate-400 truncate block">
                        {item.type === 'song' && item.rawItem?.releaseDate ? new Date(item.rawItem.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (item.rawItem?.releaseYear || '')}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-end gap-3 min-w-0 pr-2">
                      <div className="invisible group-hover:visible transition-opacity" onClick={e => e.stopPropagation()}>
                        {item.type === 'song' ? (
                          <SongActionMenu song={item.rawItem as any} />
                        ) : (
                          <button className="p-1 text-slate-400 hover:text-white">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <span className="text-sm font-normal text-slate-400 tabular-nums hidden sm:block w-10 text-right">
                        {item.type === 'song' ? formatTime(item.rawItem?.duration) : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

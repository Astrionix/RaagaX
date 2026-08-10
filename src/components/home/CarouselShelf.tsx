import React, { useState } from 'react';
import { ShelfItem } from '@/types/home';
import { Play, ChevronRight, ChevronDown, X, Shuffle } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function CarouselShelf({ title, items, icon, showPlayAll }: { title: string; items: ShelfItem[]; icon?: React.ReactNode; showPlayAll?: boolean }) {
  const { setActiveTab, setSelectedPlaylistId, setSelectedArtistId, setSelectedAlbumId, playSong } = usePlayerStore();
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
            {item.subtitle && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {showAll && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
          {/* Modal Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-8 border-b border-white/10 shrink-0 gap-4">
            <div className="flex items-center gap-3 pt-safe sm:pt-0">
              {icon}
              <h2 className="text-2xl sm:text-3xl font-black text-white">{title}</h2>
              {title.toLowerCase().includes('releases') && (
                <span className="px-2 py-0.5 rounded bg-blue-500 text-[10px] font-black tracking-wider uppercase text-white shadow-lg shadow-blue-500/30">NEW</span>
              )}
            </div>
            <button 
              onClick={() => setShowAll(false)} 
              className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 p-2.5 bg-white/10 rounded-full hover:bg-[#fa233b] hover:text-white transition-colors cursor-pointer group"
            >
              <X className="w-5 h-5 text-slate-300 group-hover:text-white" />
            </button>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center gap-4 p-4 sm:px-8 shrink-0 border-b border-white/5 bg-white/[0.02]">
            <button 
              onClick={handlePlayAll}
              className="flex-1 max-w-xs py-3 rounded-full bg-[#fa233b] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-[#fa233b]/30"
            >
              <Play className="w-4 h-4 fill-white" /> Play All
            </button>
            <button 
              onClick={handleShufflePlayAll}
              className="flex-1 max-w-xs py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>
          </div>

          {/* Modal Track List */}
          <div className="flex-1 overflow-y-auto pb-safe">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 sm:p-8">
              {uniqueItems.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="p-3 rounded-xl surface-card surface-card-hover flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="w-6 text-center text-xs font-bold text-slate-500 group-hover:text-white transition-colors">{idx + 1}</span>
                    <img src={item.imageUrl || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300'} alt={item.title} className="w-12 h-12 rounded-lg object-cover shadow-sm flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white group-hover:text-[#fa233b] transition-colors truncate">
                        {item.title}
                      </h4>
                      {item.subtitle && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => handleQuickPlay(e, item)}
                    className="p-2 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 hover:bg-[#fa233b] transition-all flex-shrink-0"
                  >
                    <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

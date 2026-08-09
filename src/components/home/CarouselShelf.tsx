import React, { useState } from 'react';
import { ShelfItem } from '@/types/home';
import { Play, ChevronRight, ChevronDown } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function CarouselShelf({ title, items }: { title: string; items: ShelfItem[] }) {
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
    } else if (item.type === 'song') {
      playSong(item as any, items as any[]);
    }
  };

  const handleQuickPlay = async (e: React.MouseEvent, item: ShelfItem) => {
    e.stopPropagation();
    
    if (item.type === 'song') {
      playSong(item as any, items as any[]);
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

  const uniqueItems = items.filter((item, index, self) =>
    index === self.findIndex((t) => t.title === item.title)
  );

  const visibleItems = showAll ? uniqueItems : uniqueItems.slice(0, 10);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white hover:underline cursor-pointer inline-block">
          {title}
        </h2>
        {items.length > 10 && (
          <button 
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            {showAll ? 'Show Less' : 'See All'}
            {showAll ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
      </div>
      
      <div className={`gap-4 pb-4 ${showAll ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid grid-rows-2 auto-cols-[144px] sm:auto-cols-[176px] grid-flow-col overflow-x-auto no-scrollbar'}`}>
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
    </section>
  );
}

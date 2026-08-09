import React from 'react';
import { ShelfItem } from '@/types/home';
import { Play } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function CarouselShelf({ title, items }: { title: string; items: ShelfItem[] }) {
  const { setActiveTab, setSelectedPlaylistId, setSelectedArtistId, setSelectedAlbumId } = usePlayerStore();

  const handleItemClick = (item: ShelfItem) => {
    if (item.type === 'playlist' || item.type === 'mix') {
      setSelectedPlaylistId(item.id);
      setActiveTab('playlist');
    } else if (item.type === 'artist') {
      setSelectedArtistId(item.id);
    } else if (item.type === 'album') {
      setSelectedAlbumId(item.id);
    }
  };
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-white mb-4 hover:underline cursor-pointer inline-block">
        {title}
      </h2>
      <div className="flex gap-5 overflow-x-auto pb-4 no-scrollbar">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => handleItemClick(item)}
            className="group flex-shrink-0 w-36 sm:w-44 glass-card p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="relative w-full aspect-square mb-3 shadow-lg rounded-md overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.title}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                  item.type === 'artist' ? 'rounded-full' : 'rounded-md'
                }`}
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <button className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#fa233b] flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all hover:scale-105 shadow-xl">
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

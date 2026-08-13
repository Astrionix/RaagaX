import React from 'react';
import { ShelfItem } from '@/types/home';
import { Play } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function QuickAccessGrid({ items }: { items: ShelfItem[] }) {
  const { setActiveTab, setSelectedPlaylistId } = usePlayerStore();

  const handleItemClick = (item: ShelfItem) => {
    if (item.title === 'Liked Songs') {
      setActiveTab('favorites');
    } else if (item.title === 'Recently Played') {
      setActiveTab('library');
    } else if (item.type === 'playlist' || item.type === 'mix') {
      setSelectedPlaylistId(item.id);
      setActiveTab('playlist');
    }
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => handleItemClick(item)}
          className="group relative flex items-center gap-3 rounded-md glass-card hover:bg-white/10 transition-colors overflow-hidden cursor-pointer h-16 sm:h-20"
        >
          <img
            src={item.imageUrl ? item.imageUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500') : '/app-icon.png'}
            alt={item.title}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
            className="w-16 h-16 sm:w-20 sm:h-20 object-cover shadow-[4px_0_10px_rgba(0,0,0,0.2)] bg-slate-800"
          />
          <span className="font-bold text-sm text-white line-clamp-2 pr-2">{item.title}</span>
          
          {/* Hover Play Button */}
          <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">
            <button className="w-10 h-10 rounded-full bg-[#fa233b] flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

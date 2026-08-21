import React from 'react';
import { ShelfItem } from '@/types/home';
import { Play } from 'lucide-react';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { haptics } from '@/lib/haptics/HapticEngine';

export function ChartListShelf({ title, items }: { title: string; items: ShelfItem[] }) {
  const { playSong } = usePlayerStore();

  const allChartSongs: Song[] = React.useMemo(() => {
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      artist: item.subtitle || 'Unknown Artist',
      artistId: `art-${item.id}`,
      album: title || 'Charts',
      albumId: `alb-${item.id}`,
      duration: 180,
      coverUrl: item.imageUrl || '/app-icon.png',
      audioUrl: '',
      genre: 'POP',
      category: 'melody',
      releaseYear: new Date().getFullYear(),
      plays: 1,
      likes: 1,
    }));
  }, [items, title]);

  return (
    <section className="mb-4 sm:mb-6 w-full max-w-4xl px-3 sm:px-0">
      <h2 className="text-[20px] sm:text-xl font-semibold leading-[26px] text-white tracking-tight cursor-pointer truncate whitespace-nowrap mb-2.5">
        {title}
      </h2>
      <div className="flex flex-col gap-1">
        {items.map((item, index) => {
          const songObj = allChartSongs[index] || {
            id: item.id,
            title: item.title,
            artist: item.subtitle || 'Unknown Artist',
            artistId: `art-${item.id}`,
            album: title || 'Charts',
            albumId: `alb-${item.id}`,
            duration: 180,
            coverUrl: item.imageUrl || '/app-icon.png',
            audioUrl: '',
            genre: 'POP',
            category: 'melody' as const,
            releaseYear: new Date().getFullYear(),
            plays: 1,
            likes: 1,
          };

          return (
            <div
              key={`${item.id || 'chart'}-${index}`}
              onClick={() => {
                haptics.lightImpact();
                playSong(songObj, allChartSongs, {
                  type: 'playlist',
                  id: `chart-${item.id}`,
                  title: title || 'Chart Tracks',
                });
              }}
              className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer select-none"
            >
              <div className="w-6 text-center text-sm font-semibold text-slate-400 group-hover:text-white">
                <span className="group-hover:hidden">{index + 1}</span>
                <Play className="w-4 h-4 hidden group-hover:block mx-auto fill-current text-[#fa233b]" />
              </div>
              <img
                src={item.imageUrl}
                alt={item.title}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                className="w-10 h-10 rounded shadow-sm object-cover bg-slate-800"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white group-hover:text-[#fa233b] transition-colors truncate">{item.title}</h4>
                <p className="text-xs text-slate-400 truncate">
                  {item.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <DownloadStatusIndicator song={songObj} size="sm" showPercentage />
                <SongActionMenu song={songObj} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

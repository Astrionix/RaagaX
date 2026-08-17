import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShelfItem } from '@/types/home';
import { Play, ChevronRight, ChevronDown, X, Shuffle, MoreHorizontal } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { getApiUrl } from '@/lib/config/apiConfig';

export interface PaginationConfig {
  enabled: boolean;
  source: {
    type: 'spotify_playlist' | 'editorial' | 'database';
    id: string;
  };
  initialHasMore?: boolean;
  total?: number;
}

interface CarouselShelfProps {
  title: string;
  items: ShelfItem[];
  icon?: React.ReactNode;
  showPlayAll?: boolean;
  pagination?: PaginationConfig;
}

export function CarouselShelf({ title, items, icon, showPlayAll, pagination }: CarouselShelfProps) {
  const { setActiveTab, setSelectedPlaylistId, setSelectedArtistId, setSelectedAlbumId, playSong, currentSong, isPlaying } = usePlayerStore();
  
  // UI State
  const [showAll, setShowAll] = useState(false);
  
  // Pagination State
  const [shelfItems, setShelfItems] = useState<ShelfItem[]>(items);
  const [hasMore, setHasMore] = useState(pagination?.initialHasMore ?? false);
  const [status, setStatus] = useState<'ready' | 'warming' | 'empty'>(items.length > 0 ? 'ready' : 'empty');
  
  // Pagination Locks & Tracking
  const loadingRef = useRef(false);
  const loadedOffsets = useRef(new Set<number>([0])); // Initial 20 is offset 0
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const observer = useRef<IntersectionObserver | null>(null);

  // Update local state if props change (e.g., language switch)
  useEffect(() => {
    setShelfItems(items);
    setHasMore(pagination?.initialHasMore ?? false);
    loadedOffsets.current = new Set([0]);
  }, [items, pagination?.initialHasMore]);

  const loadMore = useCallback(async () => {
    if (!pagination?.enabled || !hasMore || loadingRef.current) return;
    
    const nextOffset = shelfItems.length;
    if (loadedOffsets.current.has(nextOffset)) return;

    loadingRef.current = true;

    try {
      const prefLang = usePlayerStore.getState().preferredLanguage || 'Telugu';
      const res = await fetch(
        getApiUrl(`/api/browse/section?playlistId=${pagination.source.id}&lang=${encodeURIComponent(prefLang)}&offset=${nextOffset}&limit=20`)
      );
      
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      
      if (data.success) {
        setStatus(data.status || 'ready');
        
        if (data.items && data.items.length > 0) {
          loadedOffsets.current.add(nextOffset);
          
          setShelfItems(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNew = data.items.filter((item: ShelfItem) => !existingIds.has(item.id));
            return [...prev, ...uniqueNew];
          });
          
          setHasMore(data.hasMore ?? false);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err: any) {
      console.error('Failed to load more shelf items:', err);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
    }
  }, [pagination, hasMore, shelfItems.length]);

  // Auto-fetch remaining tracks when showAll modal is opened
  useEffect(() => {
    if (showAll && hasMore && !loadingRef.current) {
      const t = setTimeout(() => {
        loadMore();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [showAll, hasMore, shelfItems.length, loadMore]);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
        loadMore();
      }
    }, {
      root: null,
      rootMargin: '400px',
      threshold: 0.1
    });

    if (node) observer.current.observe(node);
  }, [loadMore, hasMore]);

  // Clean up observer and fetch on unmount
  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

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
      const rawSongs = shelfItems.map(i => i.rawItem).filter(Boolean);
      playSong(item.rawItem || (item as any), rawSongs.length > 0 ? rawSongs : (shelfItems as any[]));
    }
  };

  const handleQuickPlay = async (e: React.MouseEvent, item: ShelfItem) => {
    e.stopPropagation();
    
    if (item.type === 'song') {
      const rawSongs = shelfItems.map(i => i.rawItem).filter(Boolean);
      playSong(item.rawItem || (item as any), rawSongs.length > 0 ? rawSongs : (shelfItems as any[]));
      return;
    }

    try {
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
        songs = [];
      }

      if (songs.length > 0) {
        playSong(songs[0], songs);
      }
      btn.innerHTML = originalHtml;
    } catch (err) {
      console.error('Failed to quick play:', err);
    }
  };

  const handlePlayAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shelfItems.length === 0) return;

    const btn = e.currentTarget as HTMLButtonElement;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<svg class="animate-spin w-4 h-4 text-[#fa233b]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

    try {
      if (shelfItems[0].type === 'song') {
        const rawSongs = shelfItems.map(i => i.rawItem).filter(Boolean);
        if (rawSongs.length > 0) {
          playSong(rawSongs[0] as any, rawSongs as any[]);
        }
      } else {
        const { RealMusicEngine } = await import('@/lib/realMusicEngine');
        const engine = RealMusicEngine.getInstance();
        let songs: any[] = [];
        
        if (shelfItems[0].type === 'playlist' || shelfItems[0].type === 'mix') {
          const details = await engine.getPlaylistDetails(shelfItems[0].id);
          songs = details?.songs || [];
        } else if (shelfItems[0].type === 'album') {
          const details = await engine.getPlaylistDetails('album:' + shelfItems[0].id);
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
    if (shelfItems.length === 0) return;

    const btn = e.currentTarget as HTMLButtonElement;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<svg class="animate-spin w-4 h-4 text-[#fa233b]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

    try {
      if (shelfItems[0].type === 'song') {
        const rawSongs = shelfItems.map(i => i.rawItem).filter(Boolean);
        if (rawSongs.length > 0) {
          await usePlayerStore.getState().shufflePlay(rawSongs as any[]);
        }
      } else {
        const { RealMusicEngine } = await import('@/lib/realMusicEngine');
        const engine = RealMusicEngine.getInstance();
        let songs: any[] = [];

        if (shelfItems[0].type === 'playlist' || shelfItems[0].type === 'mix') {
          const details = await engine.getPlaylistDetails(shelfItems[0].id);
          songs = details?.songs || [];
        } else if (shelfItems[0].type === 'album') {
          const details = await engine.getPlaylistDetails('album:' + shelfItems[0].id);
          songs = details?.songs || [];
        }

        if (songs.length > 0) {
          await usePlayerStore.getState().shufflePlay(songs);
        }
      }
    } catch (err) {
      console.error('Failed to shuffle play all:', err);
    } finally {
      btn.innerHTML = originalHtml;
    }
  };

  const visibleItems = showAll ? shelfItems : shelfItems.slice(0, pagination?.enabled ? shelfItems.length : 10);
  const totalSongs = pagination?.total || shelfItems.length;

  const formatTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const totalDurationSec = shelfItems.reduce((acc, item) => acc + (item.type === 'song' ? (item.rawItem?.duration || 0) : 0), 0);
  const totalDurationHrs = Math.floor(totalDurationSec / 3600);
  const totalDurationMins = Math.floor((totalDurationSec % 3600) / 60);
  const durationText = totalDurationHrs > 0 ? `${totalDurationHrs} hr ${totalDurationMins} min` : `${totalDurationMins} min`;

  const coverImageUrl = shelfItems[0]?.imageUrl || '/app-icon.png';

  if (shelfItems.length === 0) return null;

  // The sentinel is placed ~75% of the way through the current items
  const sentinelIndex = Math.max(0, shelfItems.length - 5);

  return (
    <section className="mb-2.5 sm:mb-4">
      <div className="flex items-center justify-between mb-2 px-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          {icon}
          <h2 className="text-[20px] sm:text-xl font-semibold leading-[26px] text-white tracking-tight cursor-pointer truncate whitespace-nowrap">
            {title}
          </h2>
          {showPlayAll && shelfItems.length > 0 && (
            <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
              <button 
                onClick={handlePlayAll}
                className="p-1.5 sm:p-2 rounded-full bg-[#fa233b] hover:bg-[#fa233b]/90 text-white transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center cursor-pointer"
                title="Play All Songs"
              >
                <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-white text-white ml-0.5" />
              </button>
              <button 
                onClick={handleShufflePlayAll}
                className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer border border-white/10"
                title="Shuffle Play"
              >
                <Shuffle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          )}
        </div>
        
        {shelfItems.length > 0 && (
          <button 
            onClick={() => setShowAll(true)}
            className="text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer flex-shrink-0 ml-2"
          >
            {shelfItems[0]?.type === 'song' ? 'See All Songs' : 'See All'} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      
      <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-1.5 sm:pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {visibleItems.map((item, index) => {
          const isSentinel = pagination?.enabled && index === sentinelIndex;
          
          return (
            <div
              key={`${item.id}-${index}`}
              ref={isSentinel ? sentinelRef : null}
              onClick={() => handleItemClick(item)}
              className="group premium-card p-3 sm:p-3.5 rounded-2xl cursor-pointer w-[140px] sm:w-[172px] flex-shrink-0"
            >
              <div className="relative w-full aspect-square mb-2.5 sm:mb-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)] rounded-xl overflow-hidden bg-slate-800/80">
                <OptimizedImage
                  src={item.imageUrl}
                  alt={item.title}
                  size="card"
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-108 ${
                    item.type === 'artist' ? 'rounded-full' : 'rounded-xl'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <button 
                  onClick={(e) => handleQuickPlay(e, item)}
                  className="absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 w-9 h-9 sm:w-10 sm:h-10 rounded-full red-glow-btn text-white flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all duration-300 active:scale-90"
                >
                  <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                </button>
              </div>
              <h3 className="font-bold text-xs text-white truncate leading-tight group-hover:text-[#fa233b] transition-colors">{item.title}</h3>
              {item.subtitle && item.subtitle !== 'Unknown' && (
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-tight font-medium">{item.subtitle}</p>
              )}
            </div>
          );
        })}
        
        {/* Placeholder skeleton elements when hasMore is true */}
        {hasMore && (
          <>
            <div className="glass-card p-4 rounded-xl w-[140px] sm:w-[172px] flex-shrink-0 flex items-center justify-center animate-pulse">
               <div className="w-8 h-8 rounded-full border-2 border-[#fa233b] border-t-transparent animate-spin"></div>
            </div>
            <div className="glass-card p-4 rounded-xl w-[140px] sm:w-[172px] flex-shrink-0 animate-pulse bg-white/5"></div>
          </>
        )}
      </div>

      {showAll && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          {/* Header Gradient Background */}
          <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#fa233b]/30 to-transparent pointer-events-none opacity-40" />
          
          {/* Close Button */}
          <button 
            onClick={() => setShowAll(false)} 
            className="absolute top-4 right-4 sm:top-6 sm:right-8 p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-colors z-20 cursor-pointer shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex-1 overflow-y-auto pb-safe scroll-smooth">
            {/* Hero Section */}
            <div className="relative pt-16 pb-6 px-4 sm:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-end gap-6">
              <img 
                src={coverImageUrl} 
                alt={title}
                className="w-48 h-48 sm:w-56 sm:h-56 shadow-2xl object-cover rounded-2xl flex-shrink-0 bg-slate-800 self-center sm:self-auto border border-white/10"
              />
              <div className="flex flex-col gap-2 pb-2 w-full">
                <span className="text-xs font-bold text-[#fa233b] uppercase tracking-wider">Playlist</span>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight mb-1 flex flex-wrap items-center gap-3">
                  {title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-400 mt-1">
                  <span className="font-bold text-[var(--text-primary)]">RaagaX</span>
                  <span>•</span>
                  <span>{shelfItems.length > 0 ? shelfItems.length : totalSongs} songs</span>
                  <span>•</span>
                  <span className="text-slate-400">{durationText}</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="bg-[var(--header-bg)] backdrop-blur-2xl border-b border-[var(--border-subtle)] sticky top-0 z-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center gap-5">
                <button 
                  onClick={handlePlayAll}
                  className="w-13 h-13 p-3 rounded-full bg-[#fa233b] hover:bg-[#d91c2e] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all group"
                >
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </button>
                <button 
                  onClick={handleShufflePlayAll}
                  className="p-2 text-slate-400 hover:text-[var(--text-primary)] transition-colors"
                  title="Shuffle Play"
                >
                  <Shuffle className="w-6 h-6" />
                </button>
              </div>

              {/* Table Header */}
              <div className="hidden md:grid max-w-7xl mx-auto px-4 sm:px-8 py-2 md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_100px] gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-[var(--border-subtle)]">
                <div className="text-center">#</div>
                <div>Title</div>
                <div>Album</div>
                <div>Release</div>
                <div className="text-right pr-4">Duration</div>
              </div>
            </div>

            {/* Modal Track List */}
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 pb-20">
              {shelfItems.map((item, idx) => {
                const isCurrentlyPlaying = currentSong?.id === item.id;
                
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    onClick={() => handleItemClick(item)}
                    className={`group grid grid-cols-[32px_minmax(0,1fr)_40px] md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_100px] gap-3 sm:gap-4 items-center p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer ${isCurrentlyPlaying ? 'bg-[#fa233b]/10' : ''}`}
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
                      <img
                        src={item.imageUrl || '/app-icon.png'}
                        alt={item.title}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                        className="w-10 h-10 rounded-lg object-cover bg-slate-800"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-sm font-semibold truncate ${isCurrentlyPlaying ? 'text-[#fa233b]' : 'text-[var(--text-primary)]'}`}>
                          {item.title}
                        </h4>
                        {item.subtitle && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:block min-w-0">
                      <span className="text-xs text-slate-400 truncate block">
                        {item.type === 'song' ? (item.rawItem?.album || item.title) : item.title}
                      </span>
                    </div>

                    <div className="hidden md:block min-w-0">
                      <span className="text-xs text-slate-400 truncate block">
                        {item.type === 'song' && item.rawItem?.releaseDate ? new Date(item.rawItem.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (item.rawItem?.releaseYear || '')}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-end gap-3 min-w-0 pr-2">
                      <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {item.type === 'song' ? (
                          <SongActionMenu song={item.rawItem as any} />
                        ) : (
                          <button className="p-1 text-slate-400 hover:text-white">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums hidden sm:block w-10 text-right font-mono">
                        {item.type === 'song' ? formatTime(item.rawItem?.duration) : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {/* Bottom Infinite Scroll Sentinel & Loading Indicator */}
              {hasMore ? (
                <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-[#fa233b] border-t-transparent animate-spin"></div>
                  <span className="text-[11px] text-slate-400">Loading more tracks...</span>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500 font-medium">
                  All {shelfItems.length} songs loaded
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

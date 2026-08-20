'use client';

import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Users, ShieldCheck, Search, ArrowUpDown, Bell, Check, Sparkles, Heart } from 'lucide-react';
import { getApiUrl } from '@/lib/config/apiConfig';
import { HomeFeedGenerator } from '@/lib/home/HomeFeedGenerator';
import { ArtistAvatar } from '@/components/common/ArtistAvatar';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import cachedArtistsData from '@/lib/cached_artists.json';

const fetcher = (url: string) => fetch(getApiUrl(url)).then(r => r.json()).catch(() => null);

export function ArtistsView() {
  const {
    preferredLanguage = 'Telugu',
    setActiveTab,
    setSelectedArtistId,
    favoriteArtistIds = [],
  } = usePlayerStore();

  const [activeSubTab, setActiveSubTab] = useState<'following' | 'discover'>(
    favoriteArtistIds.length > 0 ? 'following' : 'discover'
  );
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'listeners'>('recent');

  // Dynamic artist metadata cache (for IDs followed from search/unbundled sources)
  const [dynamicArtistMetadata, setDynamicArtistMetadata] = useState<Record<string, { name: string; imageUrl: string; isVerified?: boolean }>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const cached = localStorage.getItem('raagax_resolved_artist_metadata_v1');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  const currentLang = preferredLanguage || 'Telugu';
  const fallbackArtists = HomeFeedGenerator.getArtistsForLanguage(currentLang, 24);
  
  const { data } = useSWR(`/api/home/artists?lang=${currentLang}&limit=24`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
    fallbackData: { success: true, data: fallbackArtists }
  });

  const allDiscoverArtists = data?.data && data.data.length > 0 ? data.data : fallbackArtists;

  // Build comprehensive dictionary of all seed artists across all languages
  const allSeedArtistsMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; imageUrl: string; monthlyListeners: number; genres: string[]; isVerified: boolean }>();
    
    // 1. POPULAR_ARTISTS
    POPULAR_ARTISTS.forEach((a) => {
      map.set(a.id, {
        id: a.id,
        name: a.name,
        imageUrl: a.image,
        monthlyListeners: a.monthlyListeners,
        genres: a.genres,
        isVerified: true,
      });
    });

    // 2. All languages from cached_artists.json
    const rawData = cachedArtistsData as Record<string, any[]>;
    for (const [lang, list] of Object.entries(rawData)) {
      if (Array.isArray(list)) {
        list.forEach((a) => {
          if (a && a.id && !map.has(a.id)) {
            map.set(a.id, {
              id: a.id,
              name: a.name || a.id,
              imageUrl: a.imageUrl || a.image || '/app-icon.png',
              monthlyListeners: a.followerCount || 10000000,
              genres: [lang],
              isVerified: Boolean(a.isVerified ?? true),
            });
          }
        });
      }
    }

    return map;
  }, []);

  // Background fetch unresolved artist IDs from /api/artists/:id
  useEffect(() => {
    const unresolvedIds = favoriteArtistIds.filter((id) => {
      if (allSeedArtistsMap.has(id)) return false;
      const cached = dynamicArtistMetadata[id];
      return !cached || !cached.name || /^\d+$/.test(cached.name);
    });

    if (unresolvedIds.length === 0) return;

    let isMounted = true;
    unresolvedIds.forEach(async (id) => {
      try {
        const res = await fetch(getApiUrl(`/api/artists/${encodeURIComponent(id)}?songCount=1&albumCount=1`));
        if (!res.ok) return;
        const json = await res.json();
        const artistObj = json?.data;
        if (artistObj && artistObj.name && isMounted) {
          const imgUrl = artistObj.image?.find?.((i: any) => i.quality === '500x500')?.url ||
                         artistObj.image?.[artistObj.image?.length - 1]?.url ||
                         artistObj.imageUrl ||
                         '/app-icon.png';

          setDynamicArtistMetadata((prev) => {
            const updated = {
              ...prev,
              [id]: {
                name: artistObj.name,
                imageUrl: imgUrl,
                isVerified: Boolean(artistObj.isVerified ?? true),
              },
            };
            try {
              localStorage.setItem('raagax_resolved_artist_metadata_v1', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      } catch {}
    });

    return () => {
      isMounted = false;
    };
  }, [favoriteArtistIds, allSeedArtistsMap, dynamicArtistMetadata]);

  // Resolve followed artists
  const followedArtists = useMemo(() => {
    const map = new Map<string, any>();
    
    favoriteArtistIds.forEach((id) => {
      // 1. Check allSeedArtistsMap
      const seed = allSeedArtistsMap.get(id);
      if (seed) {
        map.set(id, {
          id: seed.id,
          name: seed.name,
          imageUrl: seed.imageUrl,
          monthlyListeners: seed.monthlyListeners,
          genres: seed.genres,
          isVerified: seed.isVerified,
          status: 'Up to date',
        });
        return;
      }

      // 2. Check dynamicArtistMetadata
      const dynamicMeta = dynamicArtistMetadata[id];
      if (dynamicMeta && dynamicMeta.name && !/^\d+$/.test(dynamicMeta.name)) {
        map.set(id, {
          id,
          name: dynamicMeta.name,
          imageUrl: dynamicMeta.imageUrl || '/app-icon.png',
          monthlyListeners: 12000000,
          genres: [currentLang],
          isVerified: Boolean(dynamicMeta.isVerified ?? true),
          status: 'Up to date',
        });
        return;
      }

      // 3. Check in discover artists
      const discoverMatch = allDiscoverArtists.find((a: any) => a.id === id);
      if (discoverMatch) {
        map.set(id, {
          id,
          name: discoverMatch.name,
          imageUrl: discoverMatch.imageUrl,
          monthlyListeners: 15000000,
          genres: [currentLang],
          isVerified: discoverMatch.isVerified,
          status: 'Up to date',
        });
        return;
      }

      // 4. Clean fallback while loading
      const isNumericId = /^\d+$/.test(id);
      map.set(id, {
        id,
        name: isNumericId ? 'Artist' : id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        imageUrl: '/app-icon.png',
        monthlyListeners: 10000000,
        genres: [currentLang],
        isVerified: true,
        status: 'Up to date',
      });
    });

    let list = Array.from(map.values());

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q));
    }

    if (sortBy === 'alphabetical') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'listeners') {
      list.sort((a, b) => (b.monthlyListeners || 0) - (a.monthlyListeners || 0));
    }

    return list;
  }, [favoriteArtistIds, allSeedArtistsMap, dynamicArtistMetadata, allDiscoverArtists, searchFilter, sortBy, currentLang]);

  return (
    <div className="space-y-6 pb-12 select-none pt-2 text-white animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#fa233b]/20 border border-[#fa233b]/30 rounded-2xl text-[#fa233b] shadow-lg shadow-red-500/15">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Artists & Subscriptions</h1>
            <p className="text-xs text-slate-400">Stay updated whenever your favorite artists drop new tracks</p>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveSubTab('following')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'following'
                ? 'bg-[#fa233b] text-white shadow-md shadow-red-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Following</span>
            {favoriteArtistIds.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-bold">
                {favoriteArtistIds.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('discover')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'discover'
                ? 'bg-[#fa233b] text-white shadow-md shadow-red-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Discover Artists</span>
          </button>
        </div>
      </div>

      {/* ── FOLLOWING SUB-TAB ────────────────────────────────────────────────── */}
      {activeSubTab === 'following' && (
        <div className="space-y-6">
          {favoriteArtistIds.length > 0 ? (
            <>
              {/* Search & Sort Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search followed artists..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#fa233b] font-medium"
                  />
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-xs font-bold text-slate-400">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white font-bold focus:outline-none focus:border-[#fa233b] cursor-pointer"
                  >
                    <option value="recent" className="bg-slate-900">Recently Followed</option>
                    <option value="alphabetical" className="bg-slate-900">A → Z</option>
                    <option value="listeners" className="bg-slate-900">Most Listened</option>
                  </select>
                </div>
              </div>

              {/* Followed Artists Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {followedArtists.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => {
                      setSelectedArtistId(artist.id);
                      setActiveTab('artist');
                    }}
                    className="p-4 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] hover:border-[#fa233b]/30 transition-all cursor-pointer group shadow-sm text-center space-y-3 hover:scale-105"
                  >
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-full overflow-hidden shadow-lg border-2 border-white/10 group-hover:border-[#fa233b]/60 transition-all bg-slate-900 flex items-center justify-center">
                      <ArtistAvatar
                        name={artist.name}
                        id={artist.id}
                        imageUrl={artist.imageUrl}
                        language={currentLang}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>

                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-[#fa233b] transition-colors truncate flex items-center justify-center gap-1">
                        {artist.name}
                        {artist.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-[#fa233b] flex-shrink-0" />}
                      </h4>
                      <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Following</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-slate-400 space-y-4 bg-white/[0.01] rounded-3xl border border-dashed border-white/10 max-w-lg mx-auto p-6">
              <div className="w-16 h-16 rounded-full bg-[#fa233b]/15 border border-[#fa233b]/30 flex items-center justify-center text-[#fa233b] mx-auto shadow-lg shadow-red-500/10">
                <Users className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">No Followed Artists Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Follow your favorite artists to stay updated with their latest songs, albums, and personalized recommendations on your Home screen.
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab('discover')}
                className="px-6 py-2.5 rounded-full bg-[#fa233b] hover:bg-[#d91c2e] text-white font-black text-xs shadow-lg shadow-red-500/25 active:scale-95 transition-all cursor-pointer"
              >
                Discover Artists in {currentLang}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── DISCOVER SUB-TAB ────────────────────────────────────────────────── */}
      {activeSubTab === 'discover' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Trending & Popular Artists in {currentLang}
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {allDiscoverArtists.map((artist: any) => {
              const isFollowed = favoriteArtistIds.includes(artist.id);

              return (
                <div
                  key={artist.id}
                  onClick={() => {
                    setSelectedArtistId(artist.id);
                    setActiveTab('artist');
                  }}
                  className="group flex flex-col items-center gap-3 w-full cursor-pointer transition-transform hover:scale-105"
                >
                  <div className="relative">
                    <ArtistAvatar 
                      name={artist.name}
                      id={artist.id}
                      imageUrl={artist.imageUrl}
                      language={currentLang}
                      className="w-28 h-28 sm:w-36 sm:h-36 shadow-lg border border-white/5 group-hover:border-[#fa233b]/40 group-hover:shadow-[0_0_25px_rgba(250,35,59,0.25)] transition-all"
                    />
                    {isFollowed && (
                      <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-[#fa233b] text-white flex items-center justify-center shadow border-2 border-black">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="text-center px-1">
                    <h3 className="text-sm font-bold text-white truncate w-full group-hover:text-[#fa233b] transition-colors flex items-center justify-center gap-1">
                      {artist.name}
                      {artist.isVerified && <ShieldCheck className="w-3 h-3 text-[#fa233b] flex-shrink-0" />}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                      {isFollowed ? '✓ Following' : 'Artist'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

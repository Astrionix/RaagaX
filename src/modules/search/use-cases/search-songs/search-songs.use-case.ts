import { Endpoints } from '#common/constants'
import { apiFetch } from '#common/helpers'
import { createSongPayload } from '#modules/songs/helpers'
import type { IUseCase } from '#common/types'
import type { SearchSongAPIResponseModel, SearchSongModel } from '#modules/search/models'
import type { z } from 'zod'

export interface SearchSongsArgs {
  query: string
  page: number
  limit: number
}

interface CacheEntry {
  data: z.infer<typeof SearchSongModel>
  expiresAt: number
}

const searchCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export class SearchSongsUseCase implements IUseCase<SearchSongsArgs, z.infer<typeof SearchSongModel>> {
  public lastSource: 'cache' | 'direct' | 'sumit' = 'direct'

  constructor() {}

  async execute({ query, limit, page }: SearchSongsArgs): Promise<z.infer<typeof SearchSongModel>> {
    const cacheKey = `${query.toLowerCase().trim()}:::p${page}:::l${limit}`
    const cached = searchCache.get(cacheKey)

    if (cached && Date.now() < cached.expiresAt && cached.data.results.length > 0) {
      this.lastSource = 'cache'
      return cached.data
    }

    this.lastSource = 'direct'

    // Strategy 1: Direct JioSaavn exact search
    const { data } = await apiFetch<z.infer<typeof SearchSongAPIResponseModel>>({
      endpoint: Endpoints.search.songs,
      params: {
        q: query,
        p: page,
        n: limit
      }
    })

    if (data && data.results && data.results.length > 0) {
      const resultPayload = {
        total: data.total || 0,
        start: data.start || 0,
        results: data.results.map(createSongPayload).slice(0, limit)
      }
      searchCache.set(cacheKey, { data: resultPayload, expiresAt: Date.now() + CACHE_TTL_MS })
      return resultPayload
    }

    // Strategy 2: Phonetic normalization (collapse repeated vowels like 'aa' -> 'a', 'ee' -> 'e', 'oo' -> 'o')
    const normalized = query
      .replace(/([aeiou])\1+/gi, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized !== query && normalized.length >= 3) {
      const fallbackRes = await apiFetch<z.infer<typeof SearchSongAPIResponseModel>>({
        endpoint: Endpoints.search.songs,
        params: {
          q: normalized,
          p: page,
          n: limit
        }
      });

      if (fallbackRes.data && fallbackRes.data.results && fallbackRes.data.results.length > 0) {
        return {
          total: fallbackRes.data.total || 0,
          start: fallbackRes.data.start || 0,
          results: fallbackRes.data.results.map(createSongPayload).slice(0, limit)
        };
      }
    }

    // Strategy 3: Prefix/Core token search (e.g. "sapta sagaradaache ello" -> "sapta sagaradaache")
    const words = query.trim().split(/\s+/);
    if (words.length >= 3) {
      const coreQuery = words.slice(0, 2).join(' ');
      const coreRes = await apiFetch<z.infer<typeof SearchSongAPIResponseModel>>({
        endpoint: Endpoints.search.songs,
        params: {
          q: coreQuery,
          p: page,
          n: limit
        }
      });

      if (coreRes.data && coreRes.data.results && coreRes.data.results.length > 0) {
        return {
          total: coreRes.data.total || 0,
          start: coreRes.data.start || 0,
          results: coreRes.data.results.map(createSongPayload).slice(0, limit)
        };
      }
    }

    // Strategy 4: Autocomplete Global Search Fallback with direct song hydration
    try {
      const autocompleteRes = await apiFetch<any>({
        endpoint: Endpoints.search.all,
        params: { query }
      });

      if (autocompleteRes.data && autocompleteRes.data.songs?.data?.length > 0) {
        const songIds = autocompleteRes.data.songs.data.map((s: any) => s.id).filter(Boolean);
        if (songIds.length > 0) {
          const songsDetailRes = await apiFetch<any>({
            endpoint: Endpoints.songs.id,
            params: { pids: songIds.join(',') }
          });

          let rawList: any[] = [];
          if (Array.isArray(songsDetailRes.data?.songs)) {
            rawList = songsDetailRes.data.songs;
          } else if (Array.isArray(songsDetailRes.data)) {
            rawList = songsDetailRes.data;
          } else if (songsDetailRes.data?.songs && typeof songsDetailRes.data.songs === 'object') {
            rawList = Object.values(songsDetailRes.data.songs);
          } else if (songsDetailRes.data && typeof songsDetailRes.data === 'object') {
            rawList = Object.values(songsDetailRes.data).filter((x: any) => x && typeof x === 'object' && x.id);
          }

          if (rawList.length > 0) {
            const mapped = rawList.map((item: any) => {
              try {
                return createSongPayload(item);
              } catch {
                return null;
              }
            }).filter(Boolean);

            if (mapped.length > 0) {
              const resultPayload = {
                total: mapped.length,
                start: 0,
                results: mapped.slice(0, limit) as any
              };
              searchCache.set(cacheKey, { data: resultPayload, expiresAt: Date.now() + CACHE_TTL_MS });
              return resultPayload;
            }
          }
        }
      }
    } catch {}

    // Strategy 5: Secondary Mirror Fallback (saavn.sumit.co) with quick 3s timeout
    try {
      const sumitBase = process.env.JIOSAAVN_API_BASE_URL || 'https://saavn.sumit.co';
      const sumitUrl = `${sumitBase.replace(/\/+$/, '')}/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=${page}`;
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3000);
      const sRes = await fetch(sumitUrl, { signal: ctrl.signal });
      clearTimeout(tid);

      if (sRes.ok) {
        const sData = await sRes.json();
        const rawResults = sData.data?.results || sData.results || [];
        if (Array.isArray(rawResults) && rawResults.length > 0) {
          this.lastSource = 'sumit';
          const resultPayload = {
            total: sData.data?.total || rawResults.length,
            start: sData.data?.start || 0,
            results: rawResults.map(createSongPayload).slice(0, limit)
          };
          searchCache.set(cacheKey, { data: resultPayload, expiresAt: Date.now() + CACHE_TTL_MS });
          return resultPayload;
        }
      }
    } catch {}

    // Strategy 6: Return stale cache if available
    if (cached && cached.data.results.length > 0) {
      this.lastSource = 'cache';
      return cached.data;
    }

    return {
      total: 0,
      start: 0,
      results: []
    }
  }
}

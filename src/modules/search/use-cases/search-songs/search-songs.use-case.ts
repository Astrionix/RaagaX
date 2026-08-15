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

export class SearchSongsUseCase implements IUseCase<SearchSongsArgs, z.infer<typeof SearchSongModel>> {
  constructor() {}

  async execute({ query, limit, page }: SearchSongsArgs): Promise<z.infer<typeof SearchSongModel>> {
    // Strategy 1: Exact search
    const { data } = await apiFetch<z.infer<typeof SearchSongAPIResponseModel>>({
      endpoint: Endpoints.search.songs,
      params: {
        q: query,
        p: page,
        n: limit
      }
    })

    if (data && data.results && data.results.length > 0) {
      return {
        total: data.total || 0,
        start: data.start || 0,
        results: data.results.map(createSongPayload).slice(0, limit)
      }
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

          const rawList = Array.isArray(songsDetailRes.data?.songs) 
            ? songsDetailRes.data.songs 
            : Array.isArray(songsDetailRes.data) 
              ? songsDetailRes.data 
              : Object.values(songsDetailRes.data?.songs || {});

          if (rawList.length > 0) {
            return {
              total: rawList.length,
              start: 0,
              results: rawList.map(createSongPayload).slice(0, limit)
            };
          }
        }
      }
    } catch {}

    return {
      total: 0,
      start: 0,
      results: []
    }
  }
}

import { Endpoints } from '#common/constants'
import { apiFetch } from '#common/helpers'
import { createSearchAlbumPayload } from '#modules/search/helpers'
import type { IUseCase } from '#common/types'
import type { SearchAlbumAPIResponseModel, SearchAlbumModel } from '#modules/search/models'
import type { z } from 'zod'

export interface SearchAlbumsArgs {
  query: string
  page: number
  limit: number
}

export class SearchAlbumsUseCase implements IUseCase<SearchAlbumsArgs, z.infer<typeof SearchAlbumModel>> {
  constructor() {}

  async execute({ query, limit, page }: SearchAlbumsArgs): Promise<z.infer<typeof SearchAlbumModel>> {
    // Strategy 1: Exact search
    const { data } = await apiFetch<z.infer<typeof SearchAlbumAPIResponseModel>>({
      endpoint: Endpoints.search.albums,
      params: {
        q: query,
        p: page,
        n: limit
      }
    })

    if (data && data.results && data.results.length > 0) {
      return createSearchAlbumPayload(data);
    }

    // Strategy 2: Phonetic normalization (collapse repeated vowels)
    const normalized = query
      .replace(/([aeiou])\1+/gi, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized !== query && normalized.length >= 3) {
      const fallbackRes = await apiFetch<z.infer<typeof SearchAlbumAPIResponseModel>>({
        endpoint: Endpoints.search.albums,
        params: {
          q: normalized,
          p: page,
          n: limit
        }
      });

      if (fallbackRes.data && fallbackRes.data.results && fallbackRes.data.results.length > 0) {
        return createSearchAlbumPayload(fallbackRes.data);
      }
    }

    // Strategy 3: Prefix/Core token search
    const words = query.trim().split(/\s+/);
    if (words.length >= 3) {
      const coreQuery = words.slice(0, 2).join(' ');
      const coreRes = await apiFetch<z.infer<typeof SearchAlbumAPIResponseModel>>({
        endpoint: Endpoints.search.albums,
        params: {
          q: coreQuery,
          p: page,
          n: limit
        }
      });

      if (coreRes.data && coreRes.data.results && coreRes.data.results.length > 0) {
        return createSearchAlbumPayload(coreRes.data);
      }
    }

    return { total: 0, start: 0, results: [] };
  }
}

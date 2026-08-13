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
    const { data } = await apiFetch<z.infer<typeof SearchSongAPIResponseModel>>({
      endpoint: Endpoints.search.songs,
      params: {
        q: query,
        p: page,
        n: limit
      }
    })

    if (!data) {
      return {
        total: 0,
        start: 0,
        results: []
      }
    }

    return {
      total: data.total || 0,
      start: data.start || 0,
      results: data.results?.map(createSongPayload).slice(0, limit) || []
    }
  }
}

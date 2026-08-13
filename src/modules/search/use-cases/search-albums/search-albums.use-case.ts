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
    const { data } = await apiFetch<z.infer<typeof SearchAlbumAPIResponseModel>>({
      endpoint: Endpoints.search.albums,
      params: {
        q: query,
        p: page,
        n: limit
      }
    })

    if (!data) {
      // JioSaavn returned HTML, timed out, or network failed — return empty result
      return { total: 0, start: 0, results: [] };
    }

    return createSearchAlbumPayload(data)
  }
}

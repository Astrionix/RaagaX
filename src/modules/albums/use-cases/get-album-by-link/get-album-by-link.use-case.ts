import { Endpoints } from '#common/constants'
import { apiFetch } from '#common/helpers'
import { createAlbumPayload } from '#modules/albums/helpers'
import { HTTPException } from 'hono/http-exception'
import type { IUseCase } from '#common/types'
import type { AlbumAPIResponseModel, AlbumModel } from '#modules/albums/models'
import type { z } from 'zod'

export class GetAlbumByLinkUseCase implements IUseCase<string, z.infer<typeof AlbumModel>> {
  constructor() {}

  async execute(token: string) {
    const { data } = await apiFetch<z.infer<typeof AlbumAPIResponseModel>>({
      endpoint: Endpoints.albums.link,
      params: {
        token,
        type: 'album'
      }
    })

    if (!data) throw new HTTPException(404, { message: 'album not found' })

    return createAlbumPayload(data)
  }
}

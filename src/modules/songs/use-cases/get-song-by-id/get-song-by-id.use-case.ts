import { Endpoints } from '#common/constants'
import { apiFetch } from '#common/helpers'
import { createSongPayload } from '#modules/songs/helpers'
import { HTTPException } from 'hono/http-exception'
import type { IUseCase } from '#common/types'
import type { SongAPIResponseModel, SongModel } from '#modules/songs/models'
import type { z } from 'zod'

export interface GetSongByIdArgs {
  songIds: string
}

export class GetSongByIdUseCase implements IUseCase<GetSongByIdArgs, z.infer<typeof SongModel>[]> {
  constructor() {}

  async execute({ songIds }: GetSongByIdArgs) {
    const { data } = await apiFetch<any>({
      endpoint: Endpoints.songs.id,
      params: {
        pids: songIds
      }
    })

    const rawSongs: any[] = Array.isArray(data?.songs)
      ? data.songs
      : data && typeof data === 'object'
      ? Object.values(data).filter((v: any) => v && typeof v === 'object' && (v.id || v.song || v.title))
      : [];

    if (!rawSongs.length) throw new HTTPException(404, { message: 'song not found' })

    const songs = rawSongs.map((song) => createSongPayload(song))

    return songs
  }
}

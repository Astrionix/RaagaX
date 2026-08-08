import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { AlbumController, ArtistController, SearchController, SongController } from '#modules/index'
import { PlaylistController } from '#modules/playlists/controllers'

export const apiApp = new OpenAPIHono().basePath('/api')

apiApp.use(logger())
apiApp.use(prettyJSON())
apiApp.use(cors())

const routes = [
  new SearchController(),
  new SongController(),
  new AlbumController(),
  new ArtistController(),
  new PlaylistController()
]

routes.forEach((route) => {
  route.initRoutes()
  apiApp.route('/', route.controller)
})

apiApp.doc31('/swagger', (c) => {
  const { protocol: urlProtocol, hostname, port } = new URL(c.req.url)
  const protocol = c.req.header('x-forwarded-proto') ? `${c.req.header('x-forwarded-proto')}:` : urlProtocol

  return {
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'RaagaX API Engine',
      description: 'High performance RaagaX Music Engine providing access to songs, albums, artists, playlists, and audio streams.'
    },
    servers: [{ url: `${protocol}//${hostname}${port ? `:${port}` : ''}`, description: 'Current environment' }]
  }
})

apiApp.get(
  '/docs',
  apiReference({
    pageTitle: 'RaagaX API Documentation',
    theme: 'deepSpace',
    isEditable: false,
    layout: 'modern',
    darkMode: true,
    url: '/api/swagger'
  })
)

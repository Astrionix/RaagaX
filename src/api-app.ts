import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { AlbumController, ArtistController, SearchController, SongController } from '#modules/index'
import { PlaylistController } from '#modules/playlists/controllers'
import { DiscoveryEngine, DiscoveryLanguage, ResolvedSong } from '@/lib/discoveryEngine'

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

// ─── Charts API ───────────────────────────────────────────────────────────────

const VALID_LANGS: DiscoveryLanguage[] = ['Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English'];
const CHART_TIMEOUT_MS = 25000;

function mapEntry(entry: ResolvedSong, rank: number) {
  return {
    rank,
    isNew: entry.isNew,
    songId: entry.song.id,
    title: entry.song.title,
    artist: entry.song.artist,
    album: entry.song.album,
    artwork: entry.song.coverUrl,
    audioUrl: entry.song.audioUrl,
    duration: entry.song.duration,
    source: 'jiosaavn',
    sourceId: entry.sourceId,
    matchConfidence: entry.matchConfidence,
    compositeScore: entry.compositeScore,
    status: entry.status,
    playable: !!entry.song.audioUrl,
  };
}

apiApp.get('/charts', async (c) => {
  const language = (c.req.query('language') || 'Telugu') as DiscoveryLanguage;
  if (!VALID_LANGS.includes(language)) {
    return c.json({ success: false, error: `Invalid language. Valid: ${VALID_LANGS.join(', ')}` }, 400);
  }

  try {
    const reqUrl = new URL(c.req.url);
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
    const engine = DiscoveryEngine.getInstance(baseUrl);

    // Hard timeout — never hang forever
    const timeoutResult = new Promise<null>((resolve) => setTimeout(() => resolve(null), CHART_TIMEOUT_MS));
    const result = await Promise.race([engine.discover(language), timeoutResult]);

    if (!result) {
      return c.json({ success: true, language, source: 'timeout', status: 'updating', data: { chart: null, songs: [], newReleases: [] } });
    }

    const apiStatus = result.source === 'cache' ? 'ready'
      : result.status === 'ok' ? 'ready'
      : result.status === 'partial' ? 'stale'
      : 'updating';

    return c.json({
      success: true,
      language: result.language,
      source: result.source,
      status: apiStatus,
      data: {
        chart: {
          name: `RaagaX ${language} Top 10`,
          language: result.language,
          weekLabel: result.weekLabel,
          weekStart: result.weekStart,
          weekEnd: result.weekEnd,
          collectedAt: result.collectedAt,
        },
        songs: result.topChart.map((e, i) => mapEntry(e, i + 1)),
        newReleases: result.newReleases.map((e, i) => mapEntry(e, i + 1)),
      },
    });
  } catch (err) {
    console.error('[CHARTS] Error:', err instanceof Error ? err.message : err);
    return c.json({ success: true, language, source: 'error', status: 'error', data: { chart: null, songs: [], newReleases: [] } });
  }
});

// ─── Queue Refill API ─────────────────────────────────────────────────────────

apiApp.post('/queue-refill', async (c) => {
  try {
    const body = await c.req.json();
    const language = (body.language || 'Telugu') as DiscoveryLanguage;
    const count = Math.min(Number(body.count) || 20, 30);
    // Cap each category to avoid giant payloads
    const excludeIds: string[] = (body.excludeIds || []).slice(0, 50);
    const likedIds: string[] = (body.likedIds || []).slice(0, 20);
    const historyIds: string[] = (body.historyIds || []).slice(0, 20);

    const reqUrl = new URL(c.req.url);
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
    const engine = DiscoveryEngine.getInstance(baseUrl);
    const songs = await engine.getQueueRefill(language, excludeIds, likedIds, historyIds, count);
    return c.json({ success: true, data: { songs, count: songs.length } });
  } catch {
    return c.json({ success: false, error: 'Queue refill failed' }, 500);
  }
});

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

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { DiscoveryQueue } from '@/lib/discovery/DiscoveryQueue';
import { BROWSE_5_PLAYLISTS, TRENDING_SOURCES, WEEKLY_RELEASE_SOURCES, CLASSICS_SOURCES } from '@/lib/spotifySources';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes on Vercel Pro if available

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const force = searchParams.get('force') === 'true';

  try {
    const languages = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];
    const playlistsToSync: { id: string; name: string; language: string; category: string }[] = [];

    for (const lang of languages) {
      // 1. Trending
      if (TRENDING_SOURCES[lang]) {
        playlistsToSync.push({
          id: TRENDING_SOURCES[lang].id,
          name: TRENDING_SOURCES[lang].title,
          language: lang,
          category: 'charts'
        });
      }
      // 2. Weekly Releases
      if (WEEKLY_RELEASE_SOURCES[lang]) {
        playlistsToSync.push({
          id: WEEKLY_RELEASE_SOURCES[lang].id,
          name: WEEKLY_RELEASE_SOURCES[lang].title,
          language: lang,
          category: 'new_music'
        });
      }
      // 3. Classics
      if (CLASSICS_SOURCES[lang]) {
        playlistsToSync.push({
          id: CLASSICS_SOURCES[lang].id,
          name: CLASSICS_SOURCES[lang].title,
          language: lang,
          category: 'genres'
        });
      }
      // 4. Browse 5 Playlists
      const extra = BROWSE_5_PLAYLISTS[lang] || [];
      extra.forEach((p, idx) => {
        let category = 'playlists';
        if (idx === 0) category = 'language';
        if (idx === 3) category = 'mood';
        if (idx === 4) category = 'genres';
        playlistsToSync.push({
          id: p.id,
          name: p.title,
          language: lang,
          category
        });
      });
    }

    // Load existing caches to inspect last synced timestamps
    const { data: caches } = await supabaseAdmin
      .from('spotify_playlist_cache')
      .select('playlist_id, fetched_at, updated_at');

    const cacheMap = new Map<string, string>();
    if (caches) {
      caches.forEach(c => {
        const ts = c.updated_at || c.fetched_at;
        if (ts) {
          cacheMap.set(c.playlist_id, ts);
        }
      });
    }

    const enqueued: typeof playlistsToSync = [];
    const skipped: typeof playlistsToSync = [];

    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const p of playlistsToSync) {
      const lastSynced = cacheMap.get(p.id);
      const needsSync = force || !lastSynced || (now - new Date(lastSynced).getTime() > THREE_DAYS_MS);

      if (needsSync) {
        console.log(`[BrowseSync] Playlist: ${p.name} - Enqueuing for sync.`);
        await DiscoveryQueue.enqueue(p.id, p.language, p.category);
        enqueued.push(p);
      } else {
        console.log(`[BrowseSync] Playlist: ${p.name} - Already synced in the last 3 days, skipping.`);
        skipped.push(p);
      }
    }

    // Trigger the worker to start execution asynchronously
    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${proto}://${host}`;
    fetch(`${baseUrl}/api/cron/worker`, {
      headers: authHeader ? { 'Authorization': authHeader } : {}
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      enqueuedCount: enqueued.length,
      skippedCount: skipped.length,
      enqueued: enqueued.map(p => p.name),
      skipped: skipped.map(p => p.name)
    });
  } catch (err: any) {
    console.error('[BrowseSync] Fatal error in browse sync manager:', err);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { BROWSE_5_PLAYLISTS, TRENDING_SOURCES, NEW_RELEASES_SOURCES, CLASSICS_SOURCES } from '@/lib/spotifySources';
import { DiscoveryQueue } from '@/lib/discovery/DiscoveryQueue';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const languages = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];
    let enqueuedCount = 0;

    for (const lang of languages) {
      const trendingSource = TRENDING_SOURCES[lang] || TRENDING_SOURCES['Telugu'];
      const newReleasesSource = NEW_RELEASES_SOURCES[lang] || NEW_RELEASES_SOURCES['Telugu'];
      const classicsSource = CLASSICS_SOURCES[lang] || CLASSICS_SOURCES['Telugu'];
      const extraPlaylists = BROWSE_5_PLAYLISTS[lang] || BROWSE_5_PLAYLISTS['Telugu'];

      const sections = [
        trendingSource,
        newReleasesSource,
        classicsSource,
        ...(extraPlaylists || [])
      ].filter(s => s && s.id);

      for (const section of sections) {
        const added = await DiscoveryQueue.enqueue(section.id, lang, section.title);
        if (added) enqueuedCount++;
      }
    }

    return NextResponse.json({ success: true, message: `Prewarm triggered. Enqueued ${enqueuedCount} jobs.` });
  } catch (err) {
    console.error('[Prewarm] Fatal Error:', err);
    return NextResponse.json({ success: false, error: 'Prewarm failed' }, { status: 500 });
  }
}

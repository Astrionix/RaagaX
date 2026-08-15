import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'Telugu';
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    // 1. Fetch from spotify_playlist_cache for aggregated_new_releases (100 songs)
    const { data: cacheData } = await supabaseAdmin
      .from('spotify_playlist_cache')
      .select('data')
      .eq('playlist_id', 'aggregated_new_releases')
      .eq('language', lang)
      .maybeSingle();

    let cachedSongs: any[] = [];
    if (cacheData && cacheData.data) {
      const list = Array.isArray(cacheData.data)
        ? cacheData.data
        : (typeof cacheData.data === 'object' && Array.isArray((cacheData.data as any).songs) ? (cacheData.data as any).songs : []);
      cachedSongs = (list as any[]).filter(s => s && s.title && !s.title.includes('New Release') && s.artist !== 'Unknown');
    }

    // 2. Fetch from verified_releases
    const { data: verifiedData } = await supabaseAdmin
      .from('verified_releases')
      .select('song_metadata')
      .eq('language', lang)
      .order('official_release_date', { ascending: false })
      .order('discovered_at', { ascending: false })
      .limit(limit);

    let verifiedSongs: any[] = [];
    if (verifiedData) {
      verifiedSongs = verifiedData
        .map(row => row.song_metadata)
        .filter(s => s && s.title && !s.title.includes('New Release') && s.artist !== 'Unknown' && s.artist !== 'Various Artists');
    }

    // Merge verified & cached songs, deduplicating by ID/Title, prioritizing verified
    const merged = [...verifiedSongs, ...cachedSongs];
    const seen = new Set<string>();
    const finalSongs: any[] = [];

    for (const song of merged) {
      const key = (song.id || `${song.title}_${song.artist}`).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        finalSongs.push(song);
      }
    }

    if (finalSongs.length > 0) {
      return NextResponse.json({
        success: true,
        data: finalSongs.slice(0, limit)
      });
    }

    // Fallback to local JSON cache
    if (lang.toLowerCase() === 'telugu') {
      const fs = require('fs');
      const path = require('path');
      const cachePath = path.join(process.cwd(), 'src/lib/cached_youtube_releases.json');
      if (fs.existsSync(cachePath)) {
        const localData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        return NextResponse.json(localData);
      }
    }
    
    return NextResponse.json({ success: true, data: [] });
  } catch (error: any) {
    console.error('Error fetching new releases:', error);
    if (lang.toLowerCase() === 'telugu') {
      const fs = require('fs');
      const path = require('path');
      const cachePath = path.join(process.cwd(), 'src/lib/cached_youtube_releases.json');
      if (fs.existsSync(cachePath)) {
        const localData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        return NextResponse.json(localData);
      }
    }
    return NextResponse.json({ success: true, data: [] });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'Telugu';
  const limit = parseInt(searchParams.get('limit') || '100');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('verified_releases')
      .select('song_metadata')
      .eq('language', lang)
      .order('official_release_date', { ascending: false })
      .order('discovered_at', { ascending: false })
      .limit(limit);

    if (!error && data && data.length >= 10) {
      const songs = data.map(row => row.song_metadata);
      return NextResponse.json({
        success: true,
        data: songs
      });
    }

    // Check spotify_playlist_cache for aggregated_new_releases (100 songs)
    const { data: cacheData } = await supabase
      .from('spotify_playlist_cache')
      .select('data')
      .eq('playlist_id', 'aggregated_new_releases')
      .eq('language', lang)
      .maybeSingle();

    if (cacheData && cacheData.data && Array.isArray(cacheData.data) && cacheData.data.length > 0) {
      return NextResponse.json({
        success: true,
        data: cacheData.data.slice(0, limit)
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

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'Telugu';
  const limit = parseInt(searchParams.get('limit') || '15');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Service role is not strictly needed for SELECT since we enabled RLS public read,
  // but it's safe to use anon key or service key for server-side fetches.
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

    if (error) {
      console.log('Supabase failed or table does not exist, falling back to local JSON cache.');
      const fs = require('fs');
      const path = require('path');
      const cachePath = path.join(process.cwd(), 'src/lib/cached_youtube_releases.json');
      if (fs.existsSync(cachePath)) {
        const localData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        return NextResponse.json(localData);
      }
      throw error;
    }

    const songs = data.map(row => row.song_metadata);

    return NextResponse.json({
      success: true,
      data: songs
    });
  } catch (error: any) {
    console.error('Error fetching new releases:', error);
    // Ultimate fallback if both fail
    const fs = require('fs');
    const path = require('path');
    const cachePath = path.join(process.cwd(), 'src/lib/cached_youtube_releases.json');
    if (fs.existsSync(cachePath)) {
      const localData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      return NextResponse.json(localData);
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

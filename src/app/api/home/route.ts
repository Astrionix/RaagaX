import { NextResponse } from 'next/server';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning 👋';
  if (hour < 18) return 'Good Afternoon 👋';
  return 'Good Evening 👋';
}

import { getPlaylistId } from '@/lib/homePlaylists';
import fs from 'fs';
import path from 'path';

function getDynamicPlaylists() {
  try {
    const cachePath = path.join(process.cwd(), 'src/lib/dynamic_home_playlists.json');
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to read dynamic playlists cache');
  }
  return null;
}

function normalizeLanguage(lang: string | null | undefined): string {
  if (!lang) return 'Telugu';
  const clean = lang.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function getLanguageContent(lang: string): Record<string, ShelfItem[]> {
  const defaultLang = normalizeLanguage(lang);
  const dynamicPlaylists = getDynamicPlaylists();
  const dynamicLang = dynamicPlaylists ? dynamicPlaylists[defaultLang] : null;

  if (dynamicLang) {
    return {
      quick_access: dynamicLang.quick_access || [],
      superstars: dynamicLang.superstars || [],
      composers: dynamicLang.composers || [],
      singers: dynamicLang.singers || [],
      decades: dynamicLang.decades || [],
      genres: dynamicLang.genres || []
    };
  }

  const fallback: Record<string, ShelfItem[]> = {
    quick_access: [
      { id: getPlaylistId(defaultLang, 'Mix', '150750109'), title: `${defaultLang} Mix`, type: 'mix', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Trending', '1266643840'), title: `Trending ${defaultLang}`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Hits', '1170578801'), title: `${defaultLang} Hits`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'New Releases', '1266094331'), title: `Latest ${defaultLang}`, type: 'playlist', imageUrl: 'https://c.saavncdn.com/editorial/LatestTollywood_20250814091215_500x500.jpg' },
    ],
    superstars: [],
    composers: [],
    singers: [],
    decades: [],
    genres: []
  };

  return fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const rawLang = searchParams.get('lang') || searchParams.get('preferredLanguage') || searchParams.get('language') || 'Telugu';
  const lang = normalizeLanguage(rawLang);
  const phase = searchParams.get('phase') || 'BOOTSTRAP';

  let releaseRadar: ShelfItem[] = [];
  let daylist: any = null;
  let newMovieSongs: ShelfItem[] = [];
  let artistRadars: any[] = [];
  let name = '';

  if (userId) {
    const { data: aiData, error } = await supabase
      .from('ai_recommendations')
      .select('mixes')
      .eq('user_id', userId)
      .single();

    if (!error && aiData && aiData.mixes) {
      releaseRadar = aiData.mixes.release_radar || [];
      daylist = aiData.mixes.daylist || null;
      newMovieSongs = aiData.mixes.new_movie_songs || [];
      
      const artistMixes = aiData.mixes.artist_radars || {};
      for (const artistName in artistMixes) {
        artistRadars.push({
          id: `artist_radar_${artistName}`,
          type: 'carousel',
          title: `🎙️ ${artistName} Mix`,
          items: artistMixes[artistName].map((s: any) => ({ ...s, type: 'song', subtitle: s.album }))
        });
      }
    }

    name = searchParams.get('name') || '';
  }

  if (releaseRadar.length > 0) {
    releaseRadar = releaseRadar.map((s: any) => ({ ...s, type: 'song', subtitle: s.artist }));
  }

  let greetingStr = name ? getGreeting().replace('👋', `, ${name} 👋`) : getGreeting();
  if (phase === 'BOOTSTRAP' && !name) {
    greetingStr = 'Welcome to RaagaX 🎵';
  }

  const content = getLanguageContent(lang);
  const sections: HomeSection[] = [];

  // Lifecycle Gated Sections (Preserves original user phases)
  if (phase === 'BOOTSTRAP') {
    sections.push({
      id: 'bootstrap_discovery',
      type: 'carousel',
      title: '✨ Discover Your Sound',
      items: content.quick_access || []
    });
  } else if (phase === 'EARLY') {
    sections.push({
      id: 'early_favorites',
      type: 'carousel',
      title: '🌱 Early Favorites for You',
      items: content.genres || content.quick_access || []
    });
  } else if (phase === 'MATURE' || phase === 'DEVELOPING') {
    sections.push({
      id: 'made_for_you',
      type: 'carousel',
      title: '❤️ Made For You',
      items: content.genres || content.quick_access || []
    });
  }

  // 2. Superstar Hits
  if (content.superstars && content.superstars.length > 0) {
    sections.push({
      id: 'superstar_hits',
      type: 'carousel',
      title: `🌟 ${lang === 'English' ? 'Global Pop & Rap Icons' : `${lang} Superstar Hits`}`,
      items: content.superstars
    });
  }

  // 3. Composer Spotlight
  if (content.composers && content.composers.length > 0) {
    sections.push({
      id: 'composer_spotlight',
      type: 'carousel',
      title: `🎹 ${lang} Composer Spotlight`,
      items: content.composers
    });
  }

  // 4. Top Voices & Legends
  if (content.singers && content.singers.length > 0) {
    sections.push({
      id: 'top_voices',
      type: 'carousel',
      title: `🎙️ ${lang} Top Voices & Legends`,
      items: content.singers
    });
  }

  // Personalized Contextual Shelves (Daylist, Release Radar, New Movie Songs, Artist Radars)
  if (daylist && daylist.songs && daylist.songs.length > 0) {
    sections.push({
      id: 'daylist',
      type: 'carousel',
      title: daylist.title,
      items: daylist.songs.map((s: any) => ({ ...s, type: 'song', subtitle: s.artist }))
    });
  }

  if (releaseRadar.length > 0) {
    sections.push({
      id: 'release_radar',
      type: 'carousel',
      title: '🆕 Release Radar',
      items: releaseRadar
    });
  }

  if (newMovieSongs.length > 0) {
    sections.push({
      id: 'new_movie_songs',
      type: 'carousel',
      title: '🎬 New Movie Songs',
      items: newMovieSongs.map((s: any) => ({ ...s, type: 'song', subtitle: s.movie_name || s.album }))
    });
  }

  artistRadars.forEach(ar => sections.push(ar));

  // 5. Decade Time Machine
  if (content.decades && content.decades.length > 0) {
    sections.push({
      id: 'decade_time_machine',
      type: 'carousel',
      title: `⏳ ${lang} Decade Time Machine`,
      items: content.decades
    });
  }

  // 6. Moods & Playlists (Original All Playlists)
  if (content.genres && content.genres.length > 0) {
    sections.push({ 
      id: 'all_playlists', 
      type: 'carousel', 
      title: `🎧 ${lang} Playlists`, 
      items: content.genres 
    });
  }

  const payload: HomePayload = {
    greeting: greetingStr,
    sections
  };

  return NextResponse.json(payload);
}

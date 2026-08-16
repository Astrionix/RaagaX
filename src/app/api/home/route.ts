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

  const fallback: Record<string, ShelfItem[]> = {
    quick_access: [
      { id: '1', title: 'Liked Songs', type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Mix', '150750109'), title: `${defaultLang} Mix`, type: 'mix', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Trending', '1266643840'), title: `Trending ${defaultLang}`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Hits', '1170578801'), title: `${defaultLang} Hits`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'New Releases', '1266094331'), title: `New Releases`, type: 'playlist', imageUrl: 'https://c.saavncdn.com/editorial/LatestTollywood_20250814091215_500x500.jpg' },
    ],
    trending: [
      { id: getPlaylistId(defaultLang, 'Trending', '1134643225'), title: `Trending Now`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Viral', '1302089242'), title: `Viral Hits`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Popular', '814453257'), title: `Popular in ${defaultLang}`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Top Charts', '951897805'), title: `Top Charts`, type: 'playlist', imageUrl: '/app-icon.png' }
    ],
    hits: [
      { id: getPlaylistId(defaultLang, 'Hits', '1170578805'), title: `${defaultLang} Superhits`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Chartbusters', '1170578801'), title: `Chartbusters`, type: 'playlist', imageUrl: '/app-icon.png' }
    ],
    romantic: [
      { id: getPlaylistId(defaultLang, 'Romantic', '1170578801'), title: `Romantic`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Melodies', '1170578805'), title: `Melodies`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Love', '110048908'), title: `Love Songs`, type: 'playlist', imageUrl: '/app-icon.png' }
    ],
    party: [
      { id: getPlaylistId(defaultLang, 'Party', '1170578801'), title: `Party Anthems`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'EDM', '1170578805'), title: `EDM Mix`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Energetic', '110048908'), title: `Energetic Beats`, type: 'playlist', imageUrl: '/app-icon.png' }
    ],
    devotional: [
      { id: getPlaylistId(defaultLang, 'Devotional', '84999330'), title: `Devotional`, type: 'playlist', imageUrl: '/app-icon.png' }
    ],
    workout: [
      { id: getPlaylistId(defaultLang, 'Workout', '84999330'), title: `Workout`, type: 'playlist', imageUrl: '/app-icon.png' }
    ],
    chill: [
      { id: getPlaylistId(defaultLang, 'Lofi', '84999330'), title: `Lofi & Chill`, type: 'playlist', imageUrl: '/app-icon.png' }
    ],
    road_trip: [
      { id: getPlaylistId(defaultLang, 'Travel', '84999330'), title: `Travel`, type: 'playlist', imageUrl: '/app-icon.png' }
    ],
    sad: [
      { id: getPlaylistId(defaultLang, 'Sad', '84999330'), title: `Sad & Emotional`, type: 'playlist', imageUrl: '/app-icon.png' },
      { id: getPlaylistId(defaultLang, 'Emotional', '84999330'), title: `Emotional`, type: 'playlist', imageUrl: '/app-icon.png' }
    ],
    evergreen: []
  };

  if (!dynamicLang) return fallback;

  // Merge dynamic playlists over fallback
  return {
    quick_access: dynamicLang.quick_access && dynamicLang.quick_access.length > 0 ? dynamicLang.quick_access : fallback.quick_access,
    trending: dynamicLang.trending && dynamicLang.trending.length > 0 ? dynamicLang.trending : fallback.trending,
    hits: dynamicLang.hits && dynamicLang.hits.length > 0 ? dynamicLang.hits : fallback.hits,
    romantic: dynamicLang.romantic && dynamicLang.romantic.length > 0 ? dynamicLang.romantic : fallback.romantic,
    party: dynamicLang.party && dynamicLang.party.length > 0 ? dynamicLang.party : fallback.party,
    devotional: dynamicLang.devotional && dynamicLang.devotional.length > 0 ? dynamicLang.devotional : fallback.devotional,
    workout: dynamicLang.workout && dynamicLang.workout.length > 0 ? dynamicLang.workout : fallback.workout,
    chill: dynamicLang.chill && dynamicLang.chill.length > 0 ? dynamicLang.chill : fallback.chill,
    road_trip: dynamicLang.road_trip && dynamicLang.road_trip.length > 0 ? dynamicLang.road_trip : fallback.road_trip,
    sad: dynamicLang.sad && dynamicLang.sad.length > 0 ? dynamicLang.sad : fallback.sad,
    evergreen: dynamicLang.evergreen && dynamicLang.evergreen.length > 0 ? dynamicLang.evergreen : fallback.evergreen
  };
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

  // Lifecycle Gated Sections
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
      items: content.trending || []
    });
  } else if (phase === 'MATURE' || phase === 'DEVELOPING') {
    sections.push({
      id: 'made_for_you',
      type: 'carousel',
      title: '❤️ Made For You',
      items: content.romantic || content.quick_access || []
    });
  }

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

  const allPlaylists = [
    ...(content.trending || []),
    ...(content.hits || []),
    ...(content.romantic || []),
    ...(content.party || []),
    ...(content.devotional || []),
    ...(content.workout || []),
    ...(content.chill || []),
    ...(content.road_trip || []),
    ...(content.sad || [])
  ];

  const uniquePlaylists = Array.from(new Map(
    allPlaylists
      .filter(item => item && item.id)
      .map(item => [item.id, item])
  ).values());

  if (uniquePlaylists.length > 0) {
    sections.push({ 
      id: 'all_playlists', 
      type: 'carousel', 
      title: `🎧 ${lang} Playlists`, 
      items: uniquePlaylists 
    });
  }

  const payload: HomePayload = {
    greeting: greetingStr,
    sections
  };

  return NextResponse.json(payload);
}

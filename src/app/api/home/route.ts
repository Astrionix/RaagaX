import { NextResponse } from 'next/server';
import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning 👋';
  if (hour < 18) return 'Good Afternoon 👋';
  return 'Good Evening 👋';
}

import { getPlaylistId } from '@/lib/homePlaylists';

function getLanguageContent(lang: string): Record<string, ShelfItem[]> {
  const defaultLang = lang || 'Telugu';
  return {
    quick_access: [
      { id: '1', title: 'Liked Songs', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Mix', '150750109'), title: `${defaultLang} Mix`, type: 'mix', imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '3', title: 'Recently Played', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Trending', '1266643840'), title: `Trending ${defaultLang}`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Hits', '1170578801'), title: `${defaultLang} Hits`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'New Releases', '1266094331'), title: `New Releases`, type: 'playlist', imageUrl: 'https://c.saavncdn.com/editorial/LatestTollywood_20250814091215_500x500.jpg' },
    ],
    trending: [
      { id: getPlaylistId(defaultLang, 'Trending', '1134643225'), title: `Trending Now`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Viral', '1302089242'), title: `Viral Hits`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Popular', '814453257'), title: `Popular in ${defaultLang}`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Top Charts', '951897805'), title: `Top Charts`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    hits: [
      { id: getPlaylistId(defaultLang, 'Hits', '1170578805'), title: `${defaultLang} Superhits`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Chartbusters', '1170578801'), title: `Chartbusters`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1516280440502-86846f4142d1?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Latest Hits', '901538769'), title: `Latest Hits`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&q=80&w=300&h=300' },
    ],
    romantic: [
      { id: getPlaylistId(defaultLang, 'Romantic', '1170578801'), title: `Romantic`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Melodies', '1170578805'), title: `Melodies`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Love', '110048908'), title: `Love Songs`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1460036521480-c11c52536c99?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    party: [
      { id: getPlaylistId(defaultLang, 'Party', '1170578801'), title: `Party Anthems`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1516280440502-86846f4142d1?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'EDM', '1170578805'), title: `EDM Mix`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Energetic', '110048908'), title: `Energetic Beats`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1460036521480-c11c52536c99?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    devotional: [
      { id: getPlaylistId(defaultLang, 'Devotional', '84999330'), title: `Devotional`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1604169720546-b333a595908b?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Festival', '84999330'), title: `Festival`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    workout: [
      { id: getPlaylistId(defaultLang, 'Workout', '84999330'), title: `Workout`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Running', '84999330'), title: `Running`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    chill: [
      { id: getPlaylistId(defaultLang, 'Lofi', '84999330'), title: `Lofi & Chill`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Chill', '84999330'), title: `Chillout`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Acoustic', '84999330'), title: `Acoustic Covers`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    road_trip: [
      { id: getPlaylistId(defaultLang, 'Driving', '84999330'), title: `Driving`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Travel', '84999330'), title: `Travel`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    sad: [
      { id: getPlaylistId(defaultLang, 'Sad', '84999330'), title: `Sad & Emotional`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, 'Emotional', '84999330'), title: `Emotional`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1516280440502-86846f4142d1?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    evergreen: [
      { id: getPlaylistId(defaultLang, 'Evergreen Classics', '84999330'), title: `Evergreen Classics`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, '1990s', '84999330'), title: `90s Hits`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: getPlaylistId(defaultLang, '2000s', '84999330'), title: `2000s Hits`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=300&h=300' }
    ]
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const lang = searchParams.get('lang') || 'Telugu';

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

  const greetingStr = name ? getGreeting().replace('👋', `, ${name} 👋`) : getGreeting();
  const content = getLanguageContent(lang);

  const sections: HomeSection[] = [
    {
      id: 'quick_access',
      type: 'quick_access',
      title: '',
      items: content.quick_access
    }
  ];

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

  sections.push({
    id: 'trending',
    type: 'carousel',
    title: '🔥 Trending Now',
    items: content.trending
  });
  sections.push({
    id: 'hits',
    type: 'carousel',
    title: `🇮🇳 ${lang} Hits`,
    items: content.hits
  });
  sections.push({
    id: 'romantic',
    type: 'carousel',
    title: '❤️ Romantic Melodies',
    items: content.romantic
  });
  sections.push({
    id: 'party',
    type: 'carousel',
    title: '💃 Party Time',
    items: content.party
  });
  sections.push({
    id: 'devotional',
    type: 'carousel',
    title: '🙏 Devotional',
    items: content.devotional
  });
  sections.push({
    id: 'workout',
    type: 'carousel',
    title: '🏋️ Workout',
    items: content.workout
  });
  sections.push({
    id: 'chill',
    type: 'carousel',
    title: '🌙 Lofi & Chill',
    items: content.chill
  });
  sections.push({
    id: 'road_trip',
    type: 'carousel',
    title: '🚗 Road Trip',
    items: content.road_trip
  });
  sections.push({
    id: 'sad',
    type: 'carousel',
    title: '💔 Sad & Emotional',
    items: content.sad
  });
  sections.push({
    id: 'evergreen',
    type: 'carousel',
    title: '⭐ Evergreen Classics',
    items: content.evergreen
  });

  const payload: HomePayload = {
    greeting: greetingStr,
    sections
  };

  return NextResponse.json(payload);
}

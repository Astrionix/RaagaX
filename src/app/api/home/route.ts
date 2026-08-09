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

function getLanguageContent(lang: string) {
  // We use existing valid IDs as placeholders for now, but translate titles to match preferred language
  const defaultLang = lang || 'Telugu';
  return {
    quick_access: [
      { id: '1', title: 'Liked Songs', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '2', title: `${defaultLang} Mix`, type: 'mix', imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '3', title: 'Recently Played', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '4', title: `Trending ${defaultLang}`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '5', title: `${defaultLang} Hits`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '1266094331', title: `Latest ${defaultLang}`, type: 'playlist', imageUrl: 'https://c.saavncdn.com/editorial/LatestTollywood_20250814091215_500x500.jpg' },
    ],
    chartbusters: [
      { id: '1134643225', title: `${defaultLang}: India Superhits Top 50`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '1302089242', title: `Chartbusters 2026 - ${defaultLang}`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '814453257', title: `${defaultLang} Viral Hits`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '951897805', title: `Most Searched Songs - ${defaultLang}`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    retro: [
      { id: '1170578805', title: `${defaultLang} 2000s`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '1170578801', title: `${defaultLang} 1990s`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1516280440502-86846f4142d1?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '901538769', title: `${defaultLang} 1980s`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '901538767', title: `${defaultLang} 1970s`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?auto=format&fit=crop&q=80&w=300&h=300' }
    ],
    mood: [
      { id: '742913535', title: `90s Romance - ${defaultLang}`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '742894803', title: `2000s Romance - ${defaultLang}`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '110048908', title: `${defaultLang} Folk Songs`, type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1460036521480-c11c52536c99?auto=format&fit=crop&q=80&w=300&h=300' }
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

    const { data: userRecord } = await supabase.auth.admin.getUserById(userId);
    if (userRecord?.user?.user_metadata?.full_name) {
      name = userRecord.user.user_metadata.full_name.split(' ')[0];
    }
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
    id: 'chartbusters',
    type: 'carousel',
    title: '🏆 Chartbusters & Hits',
    items: content.chartbusters
  });

  sections.push({
    id: 'retro',
    type: 'carousel',
    title: '📻 Decades & Retro',
    items: content.retro
  });

  sections.push({
    id: 'mood',
    type: 'carousel',
    title: '🎭 Mood & Genre',
    items: content.mood
  });

  const payload: HomePayload = {
    greeting: greetingStr,
    sections
  };

  return NextResponse.json(payload);
}

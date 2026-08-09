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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  let dailyMix: ShelfItem[] = [];
  let releaseRadar: ShelfItem[] = [];
  let daylist: any = null;
  let newMovieSongs: ShelfItem[] = [];
  let artistRadars: any[] = [];
  let name = '';

  if (userId) {
    // 1. Fetch user's personalized mixes from Supabase
    const { data: aiData, error } = await supabase
      .from('ai_recommendations')
      .select('mixes')
      .eq('user_id', userId)
      .single();

    if (!error && aiData && aiData.mixes) {
      dailyMix = aiData.mixes.daily_mix || [];
      releaseRadar = aiData.mixes.release_radar || [];
      daylist = aiData.mixes.daylist || null;
      newMovieSongs = aiData.mixes.new_movie_songs || [];
      
      const artistMixes = aiData.mixes.artist_radars || {};
      for (const artistName in artistMixes) {
        artistRadars.push({
          id: `artist_mix_${artistName}`,
          type: 'carousel',
          title: `🎤 Because You Listen to ${artistName}`,
          items: artistMixes[artistName].map((s: any) => ({ ...s, type: 'song' }))
        });
      }
    }

    // Attempt to get user name
    const { data: userRecord } = await supabase.auth.admin.getUserById(userId);
    if (userRecord?.user?.user_metadata?.full_name) {
      name = userRecord.user.user_metadata.full_name.split(' ')[0];
    }
  }

  // Fallbacks if ML engine hasn't populated data for this user yet
  if (dailyMix.length === 0) {
    dailyMix = [
      { id: 'm1', title: 'Telugu Daily Mix', subtitle: 'Updated daily based on your listening', type: 'mix', imageUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: 'm2', title: 'Telugu Release Radar', subtitle: 'Catch up on the latest releases', type: 'mix', imageUrl: 'https://images.unsplash.com/photo-1483032469466-b937c425697b?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: 'm3', title: 'New Movie Songs', subtitle: 'Trending tracks from Tollywood', type: 'mix', imageUrl: 'https://images.unsplash.com/photo-1516280440502-86846f4142d1?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: 'm4', title: 'Telugu Daylist', subtitle: 'The soundtrack for your evening', type: 'mix', imageUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&q=80&w=300&h=300' },
    ];
  } else {
    // Map songs to mix format
    dailyMix = dailyMix.map((s: any) => ({ ...s, type: 'song', subtitle: s.artist }));
  }

  if (releaseRadar.length > 0) {
    releaseRadar = releaseRadar.map((s: any) => ({ ...s, type: 'song', subtitle: s.artist }));
  }

  const greetingStr = name ? getGreeting().replace('👋', `, ${name} 👋`) : getGreeting();

  const sections: HomeSection[] = [
    {
      id: 'quick_access',
      type: 'quick_access',
      title: '',
      items: [
        { id: '1', title: 'Liked Songs', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=300&h=300' },
        { id: '2', title: 'Telugu Mix', type: 'mix', imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=300&h=300' },
        { id: '3', title: 'Recently Played', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?auto=format&fit=crop&q=80&w=300&h=300' },
        { id: '4', title: 'Trending Telugu', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=300&h=300' },
        { id: '5', title: 'Anirudh Hits', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?auto=format&fit=crop&q=80&w=300&h=300' },
        { id: '1266094331', title: 'Latest Tollywood', type: 'playlist', imageUrl: 'https://c.saavncdn.com/editorial/LatestTollywood_20250814091215_500x500.jpg' },
      ]
    },
    {
      id: 'made_for_you',
      type: 'carousel',
      title: '🎯 Daily Mix',
      items: dailyMix
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

  // Add artist radars dynamically
  artistRadars.forEach(ar => sections.push(ar));

  sections.push({
    id: 'trending_telugu',
    type: 'list_chart',
    title: '🔥 Trending Telugu',
    items: [
      { id: 't1', title: 'Hukum', subtitle: 'Anirudh Ravichander', type: 'song', imageUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: 't2', title: 'Kurchi Madathapetti', subtitle: 'Thaman S', type: 'song', imageUrl: 'https://images.unsplash.com/photo-1598387993441-a3637e1066b5?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: 't3', title: 'Naa Roja Nuvve', subtitle: 'Hesham Abdul Wahab', type: 'song', imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=300&h=300' },
    ]
  });

  // Chartbusters & Hits
  sections.push({
    id: 'chartbusters',
    type: 'carousel',
    title: '🏆 Chartbusters & Hits',
    items: [
      { id: '1134643225', title: 'Telugu: India Superhits Top 50', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '1302089242', title: 'Chartbusters 2026 - Telugu', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '814453257', title: 'Telugu Viral Hits', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '951897805', title: 'Most Searched Songs', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=300&h=300' }
    ]
  });

  // Decades & Retro
  sections.push({
    id: 'retro',
    type: 'carousel',
    title: '📻 Decades & Retro',
    items: [
      { id: '1170578805', title: 'Telugu 2000s', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '1170578801', title: 'Telugu 1990s', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1516280440502-86846f4142d1?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '901538769', title: 'Telugu 1980s', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '901538767', title: 'Telugu 1970s', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?auto=format&fit=crop&q=80&w=300&h=300' }
    ]
  });

  // Mood & Genre
  sections.push({
    id: 'mood',
    type: 'carousel',
    title: '🎭 Mood & Genre',
    items: [
      { id: '742913535', title: '90s Romance - Telugu', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '742894803', title: '2000s Romance - Telugu', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=300&h=300' },
      { id: '110048908', title: 'Telugu Folk Songs', type: 'playlist', imageUrl: 'https://images.unsplash.com/photo-1460036521480-c11c52536c99?auto=format&fit=crop&q=80&w=300&h=300' }
    ]
  });

  const payload: HomePayload = {
    greeting: greetingStr,
    sections
  };

  return NextResponse.json(payload);
}

import { playlistIds, getPlaylistId } from '@/lib/homePlaylists';

export interface CuratedPlaylist {
  id: string;
  name: string;
  desc: string;
  badge?: string;
  coverUrl: string;
  language: string;
}

export const LANGUAGE_PLAYLIST_MAP: Record<string, CuratedPlaylist[]> = {
  Telugu: [
    {
      id: '150750109',
      name: 'Telugu Favourites Mix',
      desc: 'RaagaX Essential Telugu Mix',
      badge: 'Popular',
      coverUrl: 'https://c.saavncdn.com/editorial/logo/TheBeachMix_20200529143223.jpg',
      language: 'Telugu',
    },
    {
      id: '169673226',
      name: 'Telugu Chill Hits',
      desc: 'Relaxing Telugu Melodies & Lo-Fi',
      badge: 'Chill',
      coverUrl: 'https://c.saavncdn.com/editorial/ChillBoss_20260622053644.jpg',
      language: 'Telugu',
    },
    {
      id: '767984632',
      name: 'Telugu Workout',
      desc: 'High-Energy Tollywood Gym Beats',
      badge: 'Fitness',
      coverUrl: 'https://c.saavncdn.com/editorial/logo/WorkoutfromHomeTelugu_20210507075231.jpg',
      language: 'Telugu',
    },
    {
      id: '1170578801',
      name: "Telugu 90's Hits",
      desc: "Golden 90's Tollywood Nostalgia",
      badge: 'Classics',
      coverUrl: 'https://c.saavncdn.com/editorial/charts_Telugu1990s_157621_20240408063237.jpg',
      language: 'Telugu',
    },
    {
      id: '384435110',
      name: 'Telugu Love Songs',
      desc: 'Romantic Duets & Heartfelt Melodies',
      badge: 'Romance',
      coverUrl: 'https://c.saavncdn.com/editorial/RomanticMonsoonTelugu_20240610091917.jpg',
      language: 'Telugu',
    },
    {
      id: '1266643840',
      name: 'Trending Telugu',
      desc: 'Chart-topping Telugu Songs Today',
      badge: 'Trending',
      coverUrl: 'https://c.saavncdn.com/editorial/TrendingTeluguSongs_20260529073729.jpg',
      language: 'Telugu',
    },
  ],

  Hindi: [
    {
      id: '915645770',
      name: 'Hindi Favourites Mix',
      desc: 'RaagaX Essential Bollywood Mix',
      badge: 'Popular',
      coverUrl: 'https://c.saavncdn.com/editorial/logo/VYRLMixHindi_20210319055907.jpg',
      language: 'Hindi',
    },
    {
      id: '1079336813',
      name: 'Hindi Chill Hits',
      desc: 'Late Night Acoustic & Lo-Fi Hindi',
      badge: 'Chill',
      coverUrl: 'https://c.saavncdn.com/editorial/ChillMaaro-LoFiMix_20260403095103.jpg',
      language: 'Hindi',
    },
    {
      id: '111163065',
      name: 'Bollywood Workout',
      desc: 'Power Energy Gym Motivation Hits',
      badge: 'Fitness',
      coverUrl: 'https://c.saavncdn.com/editorial/Workout1Hour_20260622051759.jpg',
      language: 'Hindi',
    },
    {
      id: '1167751266',
      name: "Hindi 90's Hits",
      desc: "Golden 90's Bollywood Evergreen Hits",
      badge: 'Classics',
      coverUrl: 'https://c.saavncdn.com/editorial/charts_Hindi1990s_136920_20240408061858.jpg',
      language: 'Hindi',
    },
    {
      id: '1302033575',
      name: 'Hindi Romantic Hits',
      desc: 'Soulful Bollywood Love Ballads',
      badge: 'Romance',
      coverUrl: 'https://c.saavncdn.com/editorial/RomanticHits2026Hindi_20260707083404.jpg',
      language: 'Hindi',
    },
    {
      id: '47599074',
      name: 'Trending Hindi',
      desc: 'Top Bollywood Chartbusters',
      badge: 'Trending',
      coverUrl: 'https://c.saavncdn.com/editorial/NowTrending_20260423085344.jpg',
      language: 'Hindi',
    },
  ],

  Tamil: [
    {
      id: '1098155077',
      name: 'Tamil Favourites Mix',
      desc: 'RaagaX Essential Kollywood Mix',
      badge: 'Popular',
      coverUrl: 'https://c.saavncdn.com/editorial/TamilLoFiMix_20260409120524.jpg',
      language: 'Tamil',
    },
    {
      id: '837803163',
      name: 'Tamil Chill Melodies',
      desc: 'Peaceful & Relaxing Kollywood Melodies',
      badge: 'Chill',
      coverUrl: 'https://c.saavncdn.com/editorial/ChillHitsTamil_20251209063321.jpg',
      language: 'Tamil',
    },
    {
      id: '83412571',
      name: 'Tamil Workout',
      desc: 'High Power Kollywood Gym Beats',
      badge: 'Fitness',
      coverUrl: 'https://c.saavncdn.com/editorial/WorkoutBeatsTamil_20260623102819.jpg',
      language: 'Tamil',
    },
    {
      id: '1170578779',
      name: "Tamil 90's Hits",
      desc: "Nostalgic 90's Kollywood Classics",
      badge: 'Classics',
      coverUrl: 'https://c.saavncdn.com/editorial/charts_Tamil1990s_190250_20240408062124.jpg',
      language: 'Tamil',
    },
    {
      id: '1302055777',
      name: 'Tamil Romantic Hits',
      desc: 'Heart Touching Tamil Love Melodies',
      badge: 'Romance',
      coverUrl: 'https://c.saavncdn.com/editorial/RomanticHits2026Tamil_20260708051413.jpg',
      language: 'Tamil',
    },
    {
      id: '1268500351',
      name: 'Trending Tamil',
      desc: 'Top Kollywood Chartbusters',
      badge: 'Trending',
      coverUrl: 'https://c.saavncdn.com/editorial/TrendingTamilSongs_20251113131029.jpg',
      language: 'Tamil',
    },
  ],

  Kannada: [
    {
      id: '916888068',
      name: 'Kannada Favourites Mix',
      desc: 'RaagaX Essential Sandalwood Mix',
      badge: 'Popular',
      coverUrl: 'https://c.saavncdn.com/editorial/RapRunKannada_20250710134525.jpg',
      language: 'Kannada',
    },
    {
      id: '814425906',
      name: 'Kannada Chill Hits',
      desc: 'Soothing & Relaxing Kannada Songs',
      badge: 'Chill',
      coverUrl: 'https://c.saavncdn.com/editorial/ChillKannada_20250506124428.jpg',
      language: 'Kannada',
    },
    {
      id: '109463183',
      name: 'Kannada Workout',
      desc: 'Power Energy Sandalwood Beats',
      badge: 'Fitness',
      coverUrl: 'https://c.saavncdn.com/editorial/SakkatWorkout_20250602091736.jpg',
      language: 'Kannada',
    },
    {
      id: '1170578914',
      name: "Kannada 90's Hits",
      desc: "Golden 90's Sandalwood Era",
      badge: 'Classics',
      coverUrl: 'https://c.saavncdn.com/editorial/charts_Kannada1990s_165009_20240408062114.jpg',
      language: 'Kannada',
    },
    {
      id: '1302008549',
      name: 'Kannada Romantic Hits',
      desc: 'Heartfelt Romance in Kannada',
      badge: 'Romance',
      coverUrl: 'https://c.saavncdn.com/editorial/RomanticHits2026Kannada_20260706091907.jpg',
      language: 'Kannada',
    },
    {
      id: '1266065243',
      name: 'Trending Kannada',
      desc: 'Top Sandalwood Chartbusters',
      badge: 'Trending',
      coverUrl: 'https://c.saavncdn.com/editorial/LatestSandawlood_20250813062534.jpg',
      language: 'Kannada',
    },
  ],

  Malayalam: [
    {
      id: '968401133',
      name: 'Malayalam Favourites Mix',
      desc: 'RaagaX Essential Mollywood Mix',
      badge: 'Popular',
      coverUrl: 'https://c.saavncdn.com/editorial/DJMixMalayalam_20251230134925.jpg',
      language: 'Malayalam',
    },
    {
      id: '152714221',
      name: 'Malayalam Chill Vibes',
      desc: 'Soulful & Relaxing Malayalam Vibes',
      badge: 'Chill',
      coverUrl: 'https://c.saavncdn.com/editorial/ChillMoneChill_20260624104916.jpg',
      language: 'Malayalam',
    },
    {
      id: '148855977',
      name: 'Malayalam Workout',
      desc: 'High Energy Mollywood Workout Hits',
      badge: 'Fitness',
      coverUrl: 'https://c.saavncdn.com/editorial/WorkoutBeatsMalayalam_20260624110657.jpg',
      language: 'Malayalam',
    },
    {
      id: '1181705743',
      name: "Malayalam 90's Hits",
      desc: "Nostalgic 90's Mollywood Classics",
      badge: 'Classics',
      coverUrl: 'https://c.saavncdn.com/editorial/charts_Malayalam1990s_170434_20240408063530.jpg',
      language: 'Malayalam',
    },
    {
      id: '1302055479',
      name: 'Malayalam Love Songs',
      desc: 'Sweet & Heartfelt Romance',
      badge: 'Romance',
      coverUrl: 'https://c.saavncdn.com/editorial/RomanticHits2026Malayalam_20260706090206.jpg',
      language: 'Malayalam',
    },
    {
      id: '592722547',
      name: 'Trending Malayalam',
      desc: 'Viral & Top Charting Hits',
      badge: 'Trending',
      coverUrl: 'https://c.saavncdn.com/editorial/MalayalamViralHits_20260814140714.jpg',
      language: 'Malayalam',
    },
  ],

  English: [
    {
      id: '89191507',
      name: 'Global Favourites Mix',
      desc: 'International Billboard Essential Mix',
      badge: 'Popular',
      coverUrl: 'https://c.saavncdn.com/editorial/HalloweenPartyMixEnglish_20241018133550.jpg',
      language: 'English',
    },
    {
      id: '158049570',
      name: 'English Chill & Lo-Fi',
      desc: 'Late Night Chill & Relaxing Acoustics',
      badge: 'Chill',
      coverUrl: 'https://c.saavncdn.com/editorial/ChillBeats_20260414110016.jpg',
      language: 'English',
    },
    {
      id: '164533557',
      name: 'Power Workout Hits',
      desc: 'EDM, Pop & Hip-Hop Gym Fuel',
      badge: 'Fitness',
      coverUrl: 'https://c.saavncdn.com/editorial/ZumbaWorkout_20260722124730.jpg',
      language: 'English',
    },
    {
      id: '63116918',
      name: "English 90's Retro",
      desc: "90's Pop, Rock & Nostalgia Classics",
      badge: 'Classics',
      coverUrl: 'https://c.saavncdn.com/editorial/charts_English1990s_174795_20240408065300.jpg',
      language: 'English',
    },
    {
      id: '146767393',
      name: 'Romantic Ballads & Pop',
      desc: 'Heartfelt Love Songs & Acoustics',
      badge: 'Romance',
      coverUrl: 'https://c.saavncdn.com/editorial/RomanticRock_20240212083006.jpg',
      language: 'English',
    },
    {
      id: '902306817',
      name: 'Global Viral & Trending',
      desc: 'Worldwide Top Charting Hits',
      badge: 'Trending',
      coverUrl: 'https://c.saavncdn.com/editorial/ViralNation_20260814152713.jpg',
      language: 'English',
    },
  ],
};

/**
 * Returns curated studio playlists for any given language with automatic fallbacks
 */
export function getCuratedPlaylists(language?: string): CuratedPlaylist[] {
  if (!language) return LANGUAGE_PLAYLIST_MAP['Telugu'];

  const normalized = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
  
  if (LANGUAGE_PLAYLIST_MAP[normalized]) {
    return LANGUAGE_PLAYLIST_MAP[normalized];
  }

  // Check if language exists in raw playlistIds mapping
  if (playlistIds[normalized]) {
    const raw = playlistIds[normalized];
    return [
      {
        id: raw['Mix'] || raw['Hits'] || '150750109',
        name: `${normalized} Favourites Mix`,
        desc: `RaagaX Essential ${normalized} Mix`,
        badge: 'Popular',
        coverUrl: 'https://c.saavncdn.com/editorial/logo/TheBeachMix_20200529143223.jpg',
        language: normalized,
      },
      {
        id: raw['Chill'] || raw['Lofi'] || '169673226',
        name: `${normalized} Chill Hits`,
        desc: `Relaxing ${normalized} Melodies`,
        badge: 'Chill',
        coverUrl: 'https://c.saavncdn.com/editorial/ChillBoss_20260622053644.jpg',
        language: normalized,
      },
      {
        id: raw['Workout'] || raw['Energetic'] || '767984632',
        name: `${normalized} Workout`,
        desc: `High-Energy ${normalized} Motivation`,
        badge: 'Fitness',
        coverUrl: 'https://c.saavncdn.com/editorial/logo/WorkoutfromHomeTelugu_20210507075231.jpg',
        language: normalized,
      },
      {
        id: raw['1990s'] || raw['Hits'] || '1170578801',
        name: `${normalized} 90's Hits`,
        desc: `Golden Classics in ${normalized}`,
        badge: 'Classics',
        coverUrl: 'https://c.saavncdn.com/editorial/charts_Telugu1990s_157621_20240408063237.jpg',
        language: normalized,
      },
      {
        id: raw['Romantic'] || raw['Love'] || '384435110',
        name: `${normalized} Love Songs`,
        desc: `Romantic Melodies in ${normalized}`,
        badge: 'Romance',
        coverUrl: 'https://c.saavncdn.com/editorial/RomanticMonsoonTelugu_20240610091917.jpg',
        language: normalized,
      },
      {
        id: raw['Trending'] || raw['Latest'] || '1266643840',
        name: `Trending ${normalized}`,
        desc: `Top ${normalized} Chartbusters`,
        badge: 'Trending',
        coverUrl: 'https://c.saavncdn.com/editorial/TrendingTeluguSongs_20260529073729.jpg',
        language: normalized,
      },
    ];
  }

  // Fallback to Telugu or Hindi
  return LANGUAGE_PLAYLIST_MAP['Telugu'];
}

export const CURATED_PLAYLISTS = LANGUAGE_PLAYLIST_MAP['Telugu'];

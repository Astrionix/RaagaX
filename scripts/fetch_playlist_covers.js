const fs = require('fs');

const playlistsToFetch = {
  Telugu: [
    { id: '150750109', name: 'Telugu Favourites Mix', desc: 'RaagaX Essential Telugu Mix', badge: 'Popular' },
    { id: '169673226', name: 'Telugu Chill Hits', desc: 'Relaxing Telugu Melodies & Lo-Fi', badge: 'Chill' },
    { id: '767984632', name: 'Telugu Workout', desc: 'High-Energy Tollywood Gym Beats', badge: 'Fitness' },
    { id: '1170578801', name: "Telugu 90's Hits", desc: "Golden 90's Tollywood Nostalgia", badge: 'Classics' },
    { id: '384435110', name: 'Telugu Love Songs', desc: 'Romantic Duets & Heartfelt Melodies', badge: 'Romance' },
    { id: '1266643840', name: 'Trending Telugu', desc: 'Chart-topping Telugu Songs Today', badge: 'Trending' },
  ],
  Hindi: [
    { id: '915645770', name: 'Hindi Favourites Mix', desc: 'RaagaX Essential Bollywood Mix', badge: 'Popular' },
    { id: '1079336813', name: 'Hindi Chill Hits', desc: 'Late Night Acoustic & Lo-Fi Hindi', badge: 'Chill' },
    { id: '111163065', name: 'Bollywood Workout', desc: 'Power Energy Gym Motivation Hits', badge: 'Fitness' },
    { id: '1167751266', name: "Hindi 90's Hits", desc: "Golden 90's Bollywood Evergreen Hits", badge: 'Classics' },
    { id: '1302033575', name: 'Hindi Romantic Hits', desc: 'Soulful Bollywood Love Ballads', badge: 'Romance' },
    { id: '47599074', name: 'Trending Hindi', desc: 'Top Bollywood Chartbusters', badge: 'Trending' },
  ],
  Tamil: [
    { id: '1098155077', name: 'Tamil Favourites Mix', desc: 'RaagaX Essential Kollywood Mix', badge: 'Popular' },
    { id: '837803163', name: 'Tamil Chill Melodies', desc: 'Peaceful & Relaxing Kollywood Melodies', badge: 'Chill' },
    { id: '83412571', name: 'Tamil Workout', desc: 'High Power Kollywood Gym Beats', badge: 'Fitness' },
    { id: '1170578779', name: "Tamil 90's Hits", desc: "Nostalgic 90's Kollywood Classics", badge: 'Classics' },
    { id: '1302055777', name: 'Tamil Romantic Hits', desc: 'Heart Touching Tamil Love Melodies', badge: 'Romance' },
    { id: '1268500351', name: 'Trending Tamil', desc: 'Top Kollywood Chartbusters', badge: 'Trending' },
  ],
  Kannada: [
    { id: '916888068', name: 'Kannada Favourites Mix', desc: 'RaagaX Essential Sandalwood Mix', badge: 'Popular' },
    { id: '814425906', name: 'Kannada Chill Hits', desc: 'Soothing & Relaxing Kannada Songs', badge: 'Chill' },
    { id: '109463183', name: 'Kannada Workout', desc: 'Power Energy Sandalwood Beats', badge: 'Fitness' },
    { id: '1170578914', name: "Kannada 90's Hits", desc: "Golden 90's Sandalwood Era", badge: 'Classics' },
    { id: '1302008549', name: 'Kannada Romantic Hits', desc: 'Heartfelt Romance in Kannada', badge: 'Romance' },
    { id: '1266065243', name: 'Trending Kannada', desc: 'Top Sandalwood Chartbusters', badge: 'Trending' },
  ],
  Malayalam: [
    { id: '968401133', name: 'Malayalam Favourites Mix', desc: 'RaagaX Essential Mollywood Mix', badge: 'Popular' },
    { id: '152714221', name: 'Malayalam Chill Vibes', desc: 'Soulful & Relaxing Malayalam Vibes', badge: 'Chill' },
    { id: '148855977', name: 'Malayalam Workout', desc: 'High Energy Mollywood Workout Hits', badge: 'Fitness' },
    { id: '1181705743', name: "Malayalam 90's Hits", desc: "Nostalgic 90's Mollywood Classics", badge: 'Classics' },
    { id: '1302055479', name: 'Malayalam Love Songs', desc: 'Sweet & Heartfelt Romance', badge: 'Romance' },
    { id: '592722547', name: 'Trending Malayalam', desc: 'Viral & Top Charting Hits', badge: 'Trending' },
  ],
  English: [
    { id: '89191507', name: 'Global Favourites Mix', desc: 'International Billboard Essential Mix', badge: 'Popular' },
    { id: '158049570', name: 'English Chill & Lo-Fi', desc: 'Late Night Chill & Relaxing Acoustics', badge: 'Chill' },
    { id: '164533557', name: 'Power Workout Hits', desc: 'EDM, Pop & Hip-Hop Gym Fuel', badge: 'Fitness' },
    { id: '63116918', name: "English 90's Retro", desc: "90's Pop, Rock & Nostalgia Classics", badge: 'Classics' },
    { id: '146767393', name: 'Romantic Ballads & Pop', desc: 'Heartfelt Love Songs & Acoustics', badge: 'Romance' },
    { id: '902306817', name: 'Global Viral & Trending', desc: 'Worldwide Top Charting Hits', badge: 'Trending' },
  ],
};

function formatCoverUrl(rawUrl) {
  if (!rawUrl) return '/app-icon.png';
  let clean = rawUrl.replace('http://', 'https://');
  if (clean.includes('150x150')) {
    clean = clean.replace('150x150', '500x500');
  } else if (clean.includes('50x50')) {
    clean = clean.replace('50x50', '500x500');
  } else if (!clean.includes('500x500') && clean.endsWith('.jpg')) {
    // If it has query params e.g. .jpg?bch=...
    clean = clean.replace(/\.jpg(\?.*)?$/, '_500x500.jpg$1');
  }
  return clean;
}

async function fetchFromJioSaavn(id) {
  const url = `https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${id}&_format=json&_marker=0&ctx=web6dot0`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const text = await res.text();
      // JioSaavn sometimes prefixes JSON or has trailing text
      const cleanJson = text.trim();
      const data = JSON.parse(cleanJson);
      const rawImage = data.image || data.artwork || (data.songs && data.songs[0]?.image);
      const listname = data.listname || data.title;
      if (rawImage) {
        return {
          image: formatCoverUrl(rawImage),
          rawImage: rawImage.replace('http://', 'https://'),
          title: listname || '',
        };
      }
    }
  } catch (e) {
    console.warn(`Error fetching listid ${id}:`, e.message);
  }
  return null;
}

async function main() {
  const results = {};
  for (const [lang, list] of Object.entries(playlistsToFetch)) {
    console.log(`\n=== Fetching real covers for ${lang} ===`);
    results[lang] = [];
    for (const pl of list) {
      const info = await fetchFromJioSaavn(pl.id);
      if (info) {
        console.log(`✅ [${lang}] ${pl.name} (${pl.id}) => ${info.rawImage}`);
        results[lang].push({
          id: pl.id,
          name: pl.name,
          desc: pl.desc,
          badge: pl.badge,
          coverUrl: info.rawImage,
          language: lang,
        });
      } else {
        console.log(`⚠️ [${lang}] ${pl.name} (${pl.id}) => Fallback`);
        results[lang].push({
          id: pl.id,
          name: pl.name,
          desc: pl.desc,
          badge: pl.badge,
          coverUrl: 'https://c.saavncdn.com/editorial/logo/Telugu-WeeklyJukebox_20220617064319_500x500.jpg',
          language: lang,
        });
      }
      // Small pause to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  fs.writeFileSync('./raw_covers_result.json', JSON.stringify(results, null, 2));
  console.log('\n✅ All real JioSaavn covers fetched and saved into raw_covers_result.json');
}

main();

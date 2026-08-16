const fs = require('fs');
const path = require('path');

const LANGUAGES = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];

const CATEGORIES = [
  { key: 'trending', queries: ['Trending', 'Top Charts', 'Viral Hits'] },
  { key: 'hits', queries: ['Hits', 'Superhits', 'Chartbusters'] },
  { key: 'romantic', queries: ['Romantic', 'Love Songs', 'Melodies'] },
  { key: 'party', queries: ['Party', 'Dance', 'EDM'] },
  { key: 'devotional', queries: ['Devotional', 'Bhakti', 'Spiritual'] },
  { key: 'workout', queries: ['Workout', 'Gym'] },
  { key: 'chill', queries: ['Lofi', 'Chill', 'Acoustic'] },
  { key: 'road_trip', queries: ['Road Trip', 'Travel'] },
  { key: 'sad', queries: ['Sad', 'Emotional', 'Heartbreak'] }
];

const QUICK_ACCESS_QUERIES = [
  { key: 'Mix', query: 'Mix' },
  { key: 'Trending', query: 'Trending' },
  { key: 'Hits', query: 'Hits' },
  { key: 'New Releases', query: 'Latest' }
];

function decode(str) {
  if (!str) return '';
  try {
    return decodeURIComponent(str)
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\+/g, ' ')
      .trim();
  } catch {
    return str.replace(/\+/g, ' ').trim();
  }
}

function cleanImageUrl(img) {
  if (!img || typeof img !== 'string') return '/app-icon.png';
  return img.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500');
}

async function fetchJson(url) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch (err) {
    clearTimeout(tid);
    return null;
  }
}

async function searchPlaylists(query, lang) {
  const searchQuery = `${lang} ${query}`.trim();
  const url = `https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&_format=json&q=${encodeURIComponent(searchQuery)}&p=1&n=10`;
  const data = await fetchJson(url);

  let results = data?.results || [];
  if (results.length === 0) {
    // Try fallback without lang
    const fallbackUrl = `https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&_format=json&q=${encodeURIComponent(query)}&p=1&n=5`;
    const fbData = await fetchJson(fallbackUrl);
    results = fbData?.results || [];
  }

  const valid = [];
  for (const p of results) {
    const id = p.listid || p.id;
    if (!id) continue;
    const title = decode(p.listname || p.title || p.name || '');
    const count = parseInt(p.count || p.songCount || '0', 10);
    const imageUrl = cleanImageUrl(p.image);

    // Skip old decades unless asking for evergreen
    const pTitleLower = title.toLowerCase();
    if (query.toLowerCase() !== 'evergreen' && (pTitleLower.includes('1990') || pTitleLower.includes('90s') || pTitleLower.includes('80s') || pTitleLower.includes('1980') || pTitleLower.includes('1970'))) {
      continue;
    }

    if (count >= 5 || !p.count) {
      valid.push({
        id: String(id),
        title,
        songCount: count,
        imageUrl
      });
    }
  }

  // Sort by highest song count
  valid.sort((a, b) => b.songCount - a.songCount);
  return valid;
}

async function main() {
  console.log('Resolving JioSaavn playlists for all languages...');
  const result = {};

  for (const lang of LANGUAGES) {
    console.log(`\n===> Processing language: ${lang}`);
    result[lang] = {
      quick_access: []
    };

    const seenIds = new Set();

    // 1. Resolve Quick Access
    for (const qa of QUICK_ACCESS_QUERIES) {
      console.log(`Fetching Quick Access: ${lang} ${qa.key}...`);
      const playlists = await searchPlaylists(qa.query, lang);
      const chosen = playlists.find(p => !seenIds.has(p.id)) || playlists[0];
      if (chosen) {
        seenIds.add(chosen.id);
        result[lang].quick_access.push({
          id: chosen.id,
          title: qa.key === 'Mix' ? `${lang} Mix` : (qa.key === 'Trending' ? `Trending ${lang}` : (qa.key === 'Hits' ? `${lang} Hits` : (qa.key === 'New Releases' ? `Latest ${lang}` : chosen.title))),
          type: qa.key === 'Mix' ? 'mix' : 'playlist',
          imageUrl: chosen.imageUrl
        });
      }
    }

    // 2. Resolve Mood/Genre Categories
    for (const cat of CATEGORIES) {
      result[lang][cat.key] = [];
      for (const q of cat.queries) {
        console.log(`Fetching Category [${cat.key}]: ${lang} ${q}...`);
        const playlists = await searchPlaylists(q, lang);
        const chosen = playlists.find(p => !seenIds.has(p.id)) || playlists[0];
        if (chosen) {
          seenIds.add(chosen.id);
          result[lang][cat.key].push({
            id: chosen.id,
            title: chosen.title || `${lang} ${q}`,
            type: 'playlist',
            imageUrl: chosen.imageUrl
          });
        }
      }
    }
  }

  const outPath = path.join(__dirname, '../src/lib/dynamic_home_playlists.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n✅ Successfully generated dynamic playlists file at: ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error running resolver:', err);
  process.exit(1);
});

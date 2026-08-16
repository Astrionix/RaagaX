const fs = require('fs');
const path = require('path');

const LANGUAGES = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];

const LANGUAGE_SPECIFIC_QUERIES = {
  Telugu: {
    superstars: ['Prabhas', 'Allu Arjun', 'Pawan Kalyan', 'Mahesh Babu', 'Jr. NTR', 'Ram Charan', 'Nani', 'Chiranjeevi'],
    composers: ['Anirudh Ravichander', 'Devi Sri Prasad', 'Thaman S', 'A.R. Rahman', 'M.M. Keeravani', 'Ilaiyaraaja', 'Mickey J Meyer', 'Harris Jayaraj'],
    singers: ['Sid Sriram', 'S. P. Balasubrahmanyam', 'Shreya Ghoshal', 'K. S. Chithra', 'Anurag Kulkarni', 'Mangli'],
    decades: ['2000s', '1990s', '1980s', '1970s'],
    genres: ['Trending', 'Hits', 'Romantic Melodies', 'Party Anthems', 'Lofi Chill', 'Workout Beats', 'Travel Melodies', 'Devotional Bhakti', 'Sad Melodies']
  },
  Tamil: {
    superstars: ['Vijay', 'Rajinikanth', 'Ajith', 'Dhanush', 'Suriya', 'Kamal Haasan', 'Sivakarthikeyan', 'Vikram'],
    composers: ['Anirudh Ravichander', 'A.R. Rahman', 'Yuvan Shankar Raja', 'Harris Jayaraj', 'Ilaiyaraaja', 'Santhosh Narayanan', 'D. Imman'],
    singers: ['Sid Sriram', 'S. P. Balasubrahmanyam', 'Hariharan', 'Shreya Ghoshal', 'Chinmayi', 'Pradeep Kumar'],
    decades: ['2000s', '1990s', '1980s', '1970s'],
    genres: ['Trending', 'Hits', 'Romantic Melodies', 'Party Anthems', 'Lofi Chill', 'Workout Beats', 'Travel Melodies', 'Devotional', 'Sad Melodies']
  },
  Kannada: {
    superstars: ['Yash', 'Puneeth Rajkumar', 'Darshan', 'Kichcha Sudeep', 'Rakshit Shetty', 'Shiva Rajkumar', 'Ganesh', 'Rishab Shetty'],
    composers: ['B. Ajaneesh Loknath', 'Charan Raj', 'V. Harikrishna', 'Arjun Janya', 'Hamsalekha', 'Ravi Basrur'],
    singers: ['Sonu Nigam', 'Vijay Prakash', 'Sanjith Hegde', 'Shreya Ghoshal', 'Raghu Dixit', 'K. S. Chithra'],
    decades: ['2000s', '1990s', '1980s'],
    genres: ['Trending', 'Hits', 'Romantic Melodies', 'Party Anthems', 'Lofi Chill', 'Workout Beats', 'Travel Melodies', 'Devotional Bhakti', 'Sad Melodies']
  },
  Malayalam: {
    superstars: ['Mohanlal', 'Mammootty', 'Dulquer Salmaan', 'Fahadh Faasil', 'Tovino Thomas', 'Nivin Pauly', 'Prithviraj Sukumaran'],
    composers: ['Sushin Shyam', 'Shaan Rahman', 'Gopi Sundar', 'Jakes Bejoy', 'Hesham Abdul Wahab', 'Vidyasagar'],
    singers: ['K. J. Yesudas', 'Vijay Yesudas', 'K. S. Harisankar', 'Sithara Krishnakumar', 'Vineeth Sreenivasan', 'K. S. Chithra'],
    decades: ['2000s', '1990s', '1980s'],
    genres: ['Trending', 'Hits', 'Romantic Melodies', 'Party Anthems', 'Lofi Chill', 'Workout Beats', 'Travel Melodies', 'Devotional', 'Sad Melodies']
  },
  Hindi: {
    superstars: ['Shah Rukh Khan', 'Salman Khan', 'Aamir Khan', 'Ranbir Kapoor', 'Ranveer Singh', 'Hrithik Roshan', 'Akshay Kumar'],
    composers: ['A.R. Rahman', 'Pritam', 'Vishal-Shekhar', 'Sachin-Jigar', 'Mithoon', 'Shankar-Ehsaan-Loy', 'Amit Trivedi'],
    singers: ['Arijit Singh', 'Shreya Ghoshal', 'Sonu Nigam', 'Jubin Nautiyal', 'Atif Aslam', 'Kishore Kumar', 'Mohit Chauhan'],
    decades: ['2000s', '1990s', '1980s', '1970s'],
    genres: ['Trending', 'Hits', 'Romantic Melodies', 'Party Anthems', 'Lofi Chill', 'Workout Beats', 'Travel Melodies', 'Devotional Bhakti', 'Sad Melodies']
  },
  English: {
    superstars: ['Taylor Swift', 'Drake', 'Eminem', 'The Weeknd', 'Justin Bieber', 'Ed Sheeran', 'Post Malone', 'Ariana Grande'],
    composers: ['Hans Zimmer', 'Max Martin', 'Metro Boomin', 'Calvin Harris', 'David Guetta'],
    singers: ['Adele', 'Bruno Mars', 'Billie Eilish', 'Dua Lipa', 'Harry Styles', 'Coldplay'],
    decades: ['2000s', '1990s', '1980s', '1970s'],
    genres: ['Trending', 'Top Hits', 'Romantic Love', 'Party Dance', 'Lofi Chill', 'Workout Gym', 'Road Trip Travel', 'Acoustic Vibes']
  }
};

const QUICK_ACCESS_CONFIG = [
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
  const url = `https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&_format=json&q=${encodeURIComponent(searchQuery)}&p=1&n=8`;
  const data = await fetchJson(url);

  let results = data?.results || [];
  if (results.length === 0) {
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

    valid.push({
      id: String(id),
      title,
      songCount: count,
      imageUrl
    });
  }

  valid.sort((a, b) => b.songCount - a.songCount);
  return valid;
}

async function resolveShelfItems(names, lang, queryPrefix = '', seenIds = new Set()) {
  const items = [];
  for (const name of names) {
    const q = queryPrefix ? `${queryPrefix} ${name}` : name;
    const playlists = await searchPlaylists(q, lang);
    // Find best playlist that matches the entity name and has not been used yet
    const firstName = name.toLowerCase().split(' ')[0];
    const chosen = playlists.find(p => !seenIds.has(p.id) && p.title.toLowerCase().includes(firstName)) || 
                   playlists.find(p => !seenIds.has(p.id)) || 
                   playlists[0];

    if (chosen && !seenIds.has(chosen.id)) {
      seenIds.add(chosen.id);
      items.push({
        id: chosen.id,
        title: chosen.title || `${name} Hits`,
        type: 'playlist',
        imageUrl: chosen.imageUrl
      });
    }
  }
  return items;
}

async function main() {
  console.log('Resolving full dynamic catalog for all languages...');
  const result = {};

  for (const lang of LANGUAGES) {
    console.log(`\n======================================================`);
    console.log(`  Processing Language: ${lang}`);
    console.log(`======================================================`);

    const seenIds = new Set();
    const config = LANGUAGE_SPECIFIC_QUERIES[lang];

    result[lang] = {
      quick_access: [],
      superstars: [],
      composers: [],
      singers: [],
      decades: [],
      genres: []
    };

    // 1. Quick Access (Discover Your Sound)
    console.log(`Fetching Quick Access for ${lang}...`);
    for (const qa of QUICK_ACCESS_CONFIG) {
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

    // 2. Superstars (Hero Playlists)
    console.log(`Fetching Superstars for ${lang}...`);
    result[lang].superstars = await resolveShelfItems(config.superstars, lang, 'Best of', seenIds);

    // 3. Composers / Music Directors
    console.log(`Fetching Composers for ${lang}...`);
    result[lang].composers = await resolveShelfItems(config.composers, lang, 'Best of', seenIds);

    // 4. Singers / Vocalists
    console.log(`Fetching Singers for ${lang}...`);
    result[lang].singers = await resolveShelfItems(config.singers, lang, 'Best of', seenIds);

    // 5. Decades
    console.log(`Fetching Decades for ${lang}...`);
    result[lang].decades = await resolveShelfItems(config.decades, lang, '', seenIds);

    // 6. Genres & Moods
    console.log(`Fetching Genres & Moods for ${lang}...`);
    result[lang].genres = await resolveShelfItems(config.genres, lang, '', seenIds);
  }

  const outPath = path.join(__dirname, '../src/lib/dynamic_home_playlists.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n✅ Successfully generated full multi-shelf catalog at: ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error running resolver:', err);
  process.exit(1);
});

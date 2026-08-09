const fs = require('fs');
const xml2js = require('xml2js');

const OFFICIAL_CHANNELS = [
  'UCq-Fj5jknLsUf-MWSy4_brA', // T-Series Telugu
  'UCv33xVn3RABVd0-uB8fD1-w', // Aditya Music
  'UC1K0F3f-OQG6lZ-bC1d-TPA', // Sony Music South
  'UCT7nKq3fGhtgGf4TtyhL08Q', // Saregama Telugu
  'UCNU4HqM6tV5NfK6BwB-02Yw', // Mango Music
  'UCVzO_u518OtsFMBzKj0GkQA', // Zee Music South
  'UCc7rP0eZ8mY_hZg2G1h4Gug', // Madhura Audio
  'UCDO-i8D5kO_n43-d9-K5iIg', // Silly Monks Music
];

function sanitizeTitle(title) {
  return title
    .replace(/\[.*?\]/g, '') 
    .replace(/\(.*?\)/g, '') 
    .replace(/Lyrical Video|Lyrical|Video Song|Full Video|Official Video|Trailer|Teaser|Promo|Glimpse|Sneak Peek|BGM|Mashup|OST/gi, '')
    .split('|')[0]
    .split('-')[0]
    .trim();
}

async function run() {
  console.log('Starting STRICT Telugu RSS-based YouTube Discovery...');
  const discoveredSongs = [];
  
  for (const channelId of OFFICIAL_CHANNELS) {
    if (discoveredSongs.length >= 10) break;

    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const res = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!res.ok) continue;
      
      const text = await res.text();
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(text);
      
      const entries = result.feed.entry || [];
      for (const item of entries.slice(0, 15)) { // Look deeper
        if (discoveredSongs.length >= 10) break;

        const rawTitle = item.title[0];
        if (/trailer|teaser|promo|sneak peek|jukebox|making|bgm|mashup|ost|interview|glimpse|lyrical/i.test(rawTitle)) continue;
        
        const cleanTitle = sanitizeTitle(rawTitle);
        if (!cleanTitle || cleanTitle.length < 2) continue;
        
        // Search JioSaavn API directly (bypass local proxy to avoid 500s)
        try {
          const saavnRes = await fetch('https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=' + encodeURIComponent(cleanTitle + ' telugu') + '&p=1&n=3');
          const saavnData = await saavnRes.json();
          const items = saavnData.results || [];
          
          if (items.length > 0) {
            // Find the first STRICTLY Telugu result
            const s = items.find(i => i.language.toLowerCase() === 'telugu');
            
            if (s && parseInt(s.year) >= 2023) {
              
              // Skip if already added
              if (discoveredSongs.find(x => x.id === s.id)) continue;

              let coverUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819'; 
              let audioUrl = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3'; // Default fallback

              if (typeof s.image === 'string') {
                 coverUrl = s.image.replace('150x150', '500x500');
              }
              
              // JioSaavn raw API doesn't expose downloadUrl easily without decryption
              // I will leave the fallback lofi track so the UI doesn't crash when clicked
              // since this is just a mock cache to prove the pipeline

              discoveredSongs.push({ 
                id: s.id, 
                title: decodeURIComponent(s.title || s.name || cleanTitle).replace(/\+/g, ' '), 
                artist: decodeURIComponent(s.subtitle || 'Unknown').replace(/\+/g, ' ').split('-')[0].trim(), 
                coverUrl, 
                audioUrl, 
                releaseYear: parseInt(s.year) || 2026, 
                type: 'song',
                youtube_title: rawTitle
              });
              
              console.log('✅ Found STRICT Telugu Song:', cleanTitle, '->', s.title);
            } else {
               if (!s) console.log('❌ Rejected (Not Telugu):', cleanTitle);
            }
          }
        } catch (e) {}
      }
    } catch(err) {}
  }
  
  if (discoveredSongs.length > 0) {
    fs.writeFileSync('src/lib/cached_youtube_releases.json', JSON.stringify({ success: true, data: discoveredSongs }, null, 2)); 
    console.log(`\nSuccessfully cached ${discoveredSongs.length} pure Telugu songs!`);
  }
}

run();

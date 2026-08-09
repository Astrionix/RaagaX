const fs = require('fs');
const xml2js = require('xml2js');

const OFFICIAL_CHANNELS = [
  'UCq-Fj5jknLsUf-MWSy4_brA', // T-Series Telugu
  'UCv33xVn3RABVd0-uB8fD1-w', // Aditya Music
  'UC1K0F3f-OQG6lZ-bC1d-TPA', // Sony Music South
  'UCT7nKq3fGhtgGf4TtyhL08Q', // Saregama Telugu
  'UCNU4HqM6tV5NfK6BwB-02Yw', // Mango Music
];

function sanitizeTitle(title) {
  return title
    .replace(/\[.*?\]/g, '') // Remove brackets [Lyrical]
    .replace(/\(.*?\)/g, '') // Remove parentheses (Video Song)
    .replace(/Lyrical Video|Lyrical|Video Song|Full Video|Official Video|Trailer|Teaser|Promo/gi, '')
    .split('|')[0] // Sometimes separated by |
    .split('-')[0] // Sometimes separated by -
    .trim();
}

async function run() {
  console.log('Starting RSS-based YouTube Discovery...');
  const discoveredSongs = [];
  
  for (const channelId of OFFICIAL_CHANNELS) {
    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const res = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const text = await res.text();
      
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(text);
      
      const entries = result.feed.entry || [];
      for (const item of entries.slice(0, 5)) {
        const rawTitle = item.title[0];
        if (/trailer|teaser|promo|sneak peek|jukebox|making|bgm|mashup|ost|interview/i.test(rawTitle)) continue;
        
        const cleanTitle = sanitizeTitle(rawTitle);
        if (!cleanTitle || cleanTitle.length < 2) continue;
        
        // Search JioSaavn
        try {
          const saavnRes = await fetch('http://localhost:3000/api/search/songs?query=' + encodeURIComponent(cleanTitle + ' telugu') + '&limit=1');
          const saavnData = await saavnRes.json();
          const items = saavnData.data?.results || saavnData.results || [];
          
          if (items.length > 0) {
            const s = items[0];
            
            // Only add if it's released in recent years
            if (parseInt(s.year) >= 2023) {
              let coverUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819'; 
              if (Array.isArray(s.image)) { 
                const hi = s.image.find(i => i.quality === '500x500') || s.image[s.image.length - 1]; 
                if (hi?.url) coverUrl = hi.url; 
              } 
              
              let audioUrl = '';
              if (Array.isArray(s.downloadUrl)) {
                const hi = s.downloadUrl.find(a => a.quality === '320kbps') || s.downloadUrl.find(a => a.quality === '160kbps') || s.downloadUrl[s.downloadUrl.length - 1];
                if (hi?.url) audioUrl = hi.url;
              }

              discoveredSongs.push({ 
                id: s.id, 
                title: decodeURIComponent(s.title || s.name).replace(/\+/g, ' '), 
                artist: decodeURIComponent(s.primaryArtists || 'Unknown').replace(/\+/g, ' '), 
                coverUrl, 
                audioUrl, 
                releaseYear: parseInt(s.year) || 2026, 
                type: 'song',
                youtube_title: rawTitle
              });
              
              console.log('✅ Found:', cleanTitle, '->', s.title);
            }
          }
        } catch (e) {
          console.error('Saavn search failed for', cleanTitle);
        }
      }
    } catch(err) {
      console.error('Failed to parse RSS for', channelId);
    }
  }
  
  // Save to cache
  if (discoveredSongs.length > 0) {
    fs.writeFileSync('src/lib/cached_youtube_releases.json', JSON.stringify({ success: true, data: discoveredSongs }, null, 2)); 
    console.log(`\nSuccessfully cached ${discoveredSongs.length} real trending songs!`);
  }
}

run();

const fs = require('fs');

async function run() {
  const q = ['Irumudi Kattu telugu', 'VaareVaa VaareVaa telugu', 'Chuttamalle telugu', 'Dawoodi telugu', 'Ayudha Pooja telugu']; 
  const results = []; 
  for (const song of q) { 
    try { 
      const res = await fetch('http://localhost:3000/api/search/songs?query=' + encodeURIComponent(song) + '&limit=1'); 
      const data = await res.json(); 
      const items = data.data?.results || data.results || []; 
      if (items.length > 0) { 
        const s = items[0]; 
        
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

        results.push({ 
          id: s.id, 
          title: decodeURIComponent(s.title || s.name).replace(/\+/g, ' '), 
          artist: decodeURIComponent(s.primaryArtists || 'Unknown').replace(/\+/g, ' '), 
          coverUrl, 
          audioUrl, 
          releaseYear: parseInt(s.year) || 2026, 
          type: 'song' 
        }); 
      } 
    } catch (e) { 
      console.log(e); 
    } 
  } 
  fs.writeFileSync('src/lib/cached_youtube_releases.json', JSON.stringify({ success: true, data: results }, null, 2)); 
  console.log('Generated mock cache with ' + results.length + ' songs');
}

run();

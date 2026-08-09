const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function mockCron() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Mock songs that would have been discovered on YouTube
  const mockQueries = [
    'Irumudi Kattu telugu',
    'VaareVaa VaareVaa telugu',
    'Chuttamalle telugu',
    'Dawoodi telugu',
    'Ayudha Pooja telugu'
  ];

  console.log('Mocking YouTube Discovery Engine...');
  const discoveredSongs = [];

  for (const q of mockQueries) {
    try {
      const searchUrl = `http://localhost:3000/api/search/songs?query=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(searchUrl);
      const data = await res.json();
      
      const results = data.data?.results || data.results || [];
      if (results.length > 0) {
        const song = results[0];
        
        let coverUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819';
        if (Array.isArray(song.image)) {
          const hi = song.image.find(i => i.quality === '500x500') || song.image[song.image.length - 1];
          if (hi?.url) coverUrl = hi.url;
        }

        const canonical = {
          id: song.id,
          title: decodeURIComponent(song.title || song.name || '').replace(/\+/g, ' '),
          artist: decodeURIComponent(song.primaryArtists || song.artists?.primary?.[0]?.name || 'Unknown').replace(/\+/g, ' '),
          coverUrl,
          audioUrl: '', // stream handler
          releaseYear: parseInt(song.year) || 2026
        };

        const releaseDate = new Date(canonical.releaseYear, 7, 1); // Mock Aug 1 release

        const { error } = await supabase.from('verified_releases').upsert({
          id: canonical.id,
          title: canonical.title,
          artist: canonical.artist,
          cover_url: canonical.coverUrl,
          audio_url: canonical.audioUrl,
          youtube_published_at: new Date().toISOString(),
          official_release_date: releaseDate.toISOString(),
          language: 'Telugu',
          song_metadata: canonical
        }, { onConflict: 'id' });

        if (!error) {
          discoveredSongs.push(canonical.title);
          console.log(`Verified and Cached: ${canonical.title}`);
        } else {
          console.error(error);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  console.log(`\nSuccessfully populated ${discoveredSongs.length} releases into verified_releases cache!`);
}

mockCron();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Read from .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const playlistIds = [
  '37i9dQZF1DWTt3gMo0DLxA', // trending
  '37i9dQZF1DWWwrjLPC16W7', // new_releases
  '4dzpSKUB2IlBGkQD5IVLD9', // classics
  '37i9dQZF1DX5VOFoIqmrOV', // p1
  '37i9dQZF1DX44F1QWqYoaV', // p2
  '37i9dQZF1DXcrFZ8UTtxv9', // p3
  '37i9dQZF1DX3I9bqAkK5Dr', // p4
  '37i9dQZF1DWTw6jXuVBprS', // p5
];

async function check() {
  const { data: cachedPlaylists, error } = await supabase
    .from('spotify_playlist_cache')
    .select('playlist_id, playlist_name, expires_at')
    .in('playlist_id', playlistIds);
  if (error) {
    console.error("Error fetching cache:", error);
  } else {
    console.log("Cached playlists length:", cachedPlaylists ? cachedPlaylists.length : 'null');
  }
}

check();

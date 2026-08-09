const fs = require('fs');

const languages = ['Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English'];

const queries = [
  // Original
  'Mix', 'Hits', 'Latest', 'India Superhits Top 50', 'Chartbusters', 'Viral Hits', 'Most Searched Songs',
  '2000s', '1990s', '1980s', '1970s', '90s Romance', '2000s Romance', 'Folk Songs',
  // Mood
  'Happy', 'Sad', 'Romantic', 'Emotional', 'Chill', 'Energetic', 'Peaceful', 'Feel Good', 'Melodies',
  // Activity
  'Workout', 'Running', 'Study', 'Focus', 'Driving', 'Travel', 'Morning', 'Sleep', 'Party',
  // Style
  'Lofi', 'Acoustic', 'Classical', 'Folk', 'Rock', 'Pop', 'Hip Hop', 'Rap', 'EDM', 'Jazz', 'Instrumental',
  // Occasion
  'Devotional', 'Wedding', 'Festival', 'Birthday', 'Celebration', 'Love', 'Friendship',
  // Discovery
  'Trending', 'New Releases', 'Latest Hits', 'Top Charts', 'Viral', 'Popular', 'Underrated', 'Evergreen Classics'
];

// deduplicate queries
const uniqueQueries = [...new Set(queries)];

async function fetchIds() {
  const mapFile = {};
  
  for (const lang of languages) {
    mapFile[lang] = {};
    for (const q of uniqueQueries) {
      const fullQuery = `${lang} ${q}`;
      try {
        const res = await fetch(`https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${encodeURIComponent(fullQuery)}&_format=json&_marker=0&ctx=web6dot0`);
        const data = await res.json();
        if (data.playlists && data.playlists.data && data.playlists.data.length > 0) {
          mapFile[lang][q] = data.playlists.data[0].id;
        } else {
          mapFile[lang][q] = '84999330'; // fallback
        }
      } catch(e) {
        mapFile[lang][q] = '84999330';
      }
    }
  }
  
  const newContent = `export const playlistIds: Record<string, Record<string, string>> = ${JSON.stringify(mapFile, null, 2)};

export function getPlaylistId(lang: string, query: string, fallback: string): string {
  if (playlistIds[lang] && playlistIds[lang][query]) {
    return playlistIds[lang][query];
  }
  // Default to Telugu if language not found
  if (playlistIds["Telugu"] && playlistIds["Telugu"][query]) {
    return playlistIds["Telugu"][query];
  }
  return fallback;
}
`;
  
  fs.writeFileSync('src/lib/homePlaylists.ts', newContent);
  console.log('Done mapping massive IDs.');
}

fetchIds();

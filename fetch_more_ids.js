const fs = require('fs');
const languages = ['Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English'];
const queries = [
  'Devotional', 'Party', 'Workout', 'Lofi', 'Sad', 'Melodies'
];

async function fetchIds() {
  const mapFile = JSON.parse(fs.readFileSync('src/lib/homePlaylists.ts', 'utf8').replace('export const playlistIds: Record<string, Record<string, string>> = ', '').replace(/;\s*export function getPlaylistId.*/s, ''));
  
  for (const lang of languages) {
    if (!mapFile[lang]) mapFile[lang] = {};
    for (const q of queries) {
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
  console.log('Done mapping extra IDs.');
}
fetchIds();

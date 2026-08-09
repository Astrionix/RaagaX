const languages = ['Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English'];
const queries = [
  'Mix', 'Trending', 'Hits', 'Latest',
  'India Superhits Top 50', 'Chartbusters', 'Viral Hits', 'Most Searched Songs',
  '2000s', '1990s', '1980s', '1970s',
  '90s Romance', '2000s Romance', 'Folk Songs'
];
async function fetchIds() {
  const map = {};
  for (const lang of languages) {
    map[lang] = {};
    for (const q of queries) {
      const fullQuery = `${lang} ${q}`;
      try {
        const res = await fetch(`https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${encodeURIComponent(fullQuery)}&_format=json&_marker=0&ctx=web6dot0`);
        const data = await res.json();
        if (data.playlists && data.playlists.data && data.playlists.data.length > 0) {
          map[lang][q] = data.playlists.data[0].id;
        } else {
          map[lang][q] = '84999330'; // fallback
        }
      } catch(e) {
        map[lang][q] = '84999330';
      }
    }
  }
  require('fs').writeFileSync('playlist_map.json', JSON.stringify(map, null, 2));
  console.log('Done mapping.');
}
fetchIds();

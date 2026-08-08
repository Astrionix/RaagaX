const fetch = require('node-fetch'); // We'll just rely on global fetch since Node 24 supports it, wait, script doesn't need require.

async function check() {
  const titles = [
    "Aaya Sher (From The Paradise) Telugu",
    "Basinga Balaalu",
    "Neno Butterfly",
    "Chikiri Chikiri"
  ];
  
  for (const title of titles) {
    const query = encodeURIComponent(title);
    const url = `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        console.log(`[FOUND] ${title} -> ${data.results[0].releaseDate}`);
      } else {
        console.log(`[NOT FOUND] ${title}`);
      }
    } catch (e) {
      console.log(`[ERROR] ${title}`);
    }
  }
}
check();

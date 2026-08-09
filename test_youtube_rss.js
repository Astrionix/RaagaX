const https = require('https');

const CHANNELS = [
  'UCv33xVn3RABVd0-uB8fD1-w', // Aditya Music
  'UC1K0F3f-OQG6lZ-bC1d-TPA', // Sony Music South
];

async function fetchChannel(channelId) {
  return new Promise((resolve) => {
    https.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const results = [];
        const entries = data.split('<entry>');
        for (let i = 1; i < entries.length; i++) {
          const titleMatch = entries[i].match(/<title>(.*?)<\/title>/);
          const publishedMatch = entries[i].match(/<published>(.*?)<\/published>/);
          if (titleMatch && publishedMatch) {
            results.push({
              title: titleMatch[1],
              publishedAt: publishedMatch[1]
            });
          }
        }
        resolve(results);
      });
    });
  });
}

async function test() {
  for (const c of CHANNELS) {
    console.log(`\nChannel: ${c}`);
    const items = await fetchChannel(c);
    console.log(items.slice(0, 5));
  }
}
test();

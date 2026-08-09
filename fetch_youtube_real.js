const xml2js = require('xml2js');

const handles = [
  'adityamusic',
  'TSeriesTelugu',
  'zeemusicsouth',
  'MangoMusic',
  'sonymusicsouthofficial',
];

async function run() {
  const parser = new xml2js.Parser();
  console.log("Fetching recent uploads from official Telugu channels...");
  
  for (const handle of handles) {
    try {
      // Fetch channel page to get channelId
      const pageRes = await fetch(`https://www.youtube.com/@${handle}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      const html = await pageRes.text();
      const match = html.match(/"channelId":"([^"]+)"/);
      if (!match) {
        console.log(`Failed to find channelId for @${handle}`);
        continue;
      }
      
      const channelId = match[1];
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const rssRes = await fetch(rssUrl);
      const text = await rssRes.text();
      const result = await parser.parseStringPromise(text);
      
      const entries = result.feed.entry || [];
      const recent = entries.slice(0, 3).map(e => e.title[0]);
      console.log(`\nChannel: @${handle}`);
      recent.forEach(r => console.log(` - ${r}`));
    } catch (e) {
      console.log(`Error for @${handle}: ${e.message}`);
    }
  }
}

run();

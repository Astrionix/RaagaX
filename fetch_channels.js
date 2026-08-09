const https = require('https'); 

const channels = [
  'adityamusic',
  'TSeriesTelugu',
  'sonymusicsouthofficial',
  'MangoMusic',
  'MangoMusicSouth',
  'TSeries',
  'SonyMusicIndia',
  'TipsTelugu',
  'SaregamaTelugu',
  'SpeedRecordsTelugu',
  'MangoMassMedia',
  'JungleeMusicTelugu',
  'TimesMusic',
  'DivoMusic',
  'DivoMusicTelugu'
];

async function run() {
  for (const c of channels) {
    await new Promise(resolve => {
      https.get('https://www.youtube.com/@' + c, res => { 
        let data = ''; 
        res.on('data', chunk => data += chunk); 
        res.on('end', () => { 
          const match = data.match(/itemprop="identifier" content="(UC.*?)"/); 
          if(match) console.log(`  '${match[1]}', // ${c}`); 
          else { 
            const m2 = data.match(/"channelId":"(UC.*?)"/); 
            if(m2) console.log(`  '${m2[1]}', // ${c}`); 
            else console.log(`  // '${c}' Not found`); 
          } 
          resolve();
        });
      });
    });
  }
}
run();

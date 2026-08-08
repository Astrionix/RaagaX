const { JioSaavnProvider } = require('../src/lib/discovery/JioSaavnProvider');
const { SongResolver } = require('../src/lib/discovery/SongResolver');

async function test() {
  const provider = new JioSaavnProvider();
  
  const verifiedCandidates = [
    { id: 'vc1', title: 'Rakasikara', artist: '', language: 'telugu', releaseDate: '2026-07-31' },
    { id: 'vc2', title: 'Patnam Pothav Bava', artist: '', language: 'telugu', releaseDate: '2026-07-31' },
    { id: 'vc3', title: 'Bangaram', artist: '', language: 'telugu', releaseDate: '2026-07-30' },
    { id: 'vc4', title: 'Pacha Pulla', artist: '', language: 'telugu', releaseDate: '2026-07-30' },
    { id: 'vc5', title: 'Milky Beauty', artist: '', language: 'telugu', releaseDate: '2026-07-30' },
  ];

  for (const c of verifiedCandidates) {
    console.log(`\nTesting: ${c.title}`);
    try {
      const results = await provider.search(c.title, 1);
      if (results && results.length > 0) {
        console.log(`Found on JioSaavn: ${results[0].title} by ${results[0].artist}`);
        const confidence = SongResolver.evaluateCandidate(results[0]);
        console.log(`Confidence Score: ${confidence}`);
        if (confidence < 70) console.log("=> REJECTED by SongResolver (Confidence < 70)");
        else console.log("=> ACCEPTED");
      } else {
        console.log("=> REJECTED: Not found on JioSaavn");
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}
test();

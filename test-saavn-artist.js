const https = require('https');

https.get('https://saavn.sumit.co/api/artists?id=456269&page=0&songCount=50&albumCount=50', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Success:', json.success);
      if (json.data) {
        console.log('Data keys:', Object.keys(json.data));
      } else {
        console.log('No data object. Root keys:', Object.keys(json));
      }
    } catch (e) {
      console.log('Error parsing JSON');
    }
  });
}).on('error', (e) => {
  console.error(e);
});

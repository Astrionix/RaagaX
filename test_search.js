const fetch = require('node-fetch');
fetch('https://www.jiosaavn.com/api.php?__call=search.getResults&q=New%20Telugu%20Songs&n=12&p=1&_format=json&_marker=0&ctx=web6dot0')
  .then(r => r.json())
  .then(d => {
    if (d.results) {
      console.log(d.results.map(s => s.title).join(', '));
    } else {
      console.log(Object.keys(d));
    }
  }).catch(e => console.error(e));

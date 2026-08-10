async function test() {
  const url = `https://open.spotify.com/embed/playlist/1LdLGtTL7UDxYoCAvSu3sK`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const split1 = html.split('<script id="__NEXT_DATA__" type="application/json">');
  const split2 = split1[1].split('</script>');
  const data = JSON.parse(split2[0]);
  const trackList = data?.props?.pageProps?.state?.data?.entity?.trackList;
  console.log('TrackList count:', trackList ? trackList.length : 0);
  if (trackList && trackList.length > 0) {
    console.log('Sample track:', trackList[0]);
  }
}
test();

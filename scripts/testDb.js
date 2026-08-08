async function test() {
  try {
    const res = await fetch("http://localhost:3001/api/home?language=telugu");
    const json = await res.json();
    console.log("New Releases count:", json.data.newReleases?.length);
    console.log(JSON.stringify(json.data.newReleases.map(x => x.title), null, 2));
  } catch(e) {
    console.error(e);
  }
}
test();

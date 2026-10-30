interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const target = url.searchParams.get('url');

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  if (!target) {
    return new Response('Missing url query parameter', {
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const range = context.request.headers.get('range');
  const headers: Record<string, string> = {
    'User-Agent': 'Raaga-Web-AudioProxy/1.0',
  };
  if (range) headers['Range'] = range;

  try {
    const fetchRes = await fetch(target, { headers });
    const responseHeaders = new Headers(fetchRes.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Accept-Ranges', 'bytes');
    return new Response(fetchRes.body, {
      status: fetchRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(`Audio stream proxy failed: ${err?.message || String(err)}`, {
      status: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

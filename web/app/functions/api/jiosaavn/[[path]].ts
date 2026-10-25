/**
 * Cloudflare Pages Function: reverse proxy for JioSaavn API to bypass browser CORS restrictions.
 */
export async function onRequest(context: { request: Request; params: { path?: string[] } }) {
  const url = new URL(context.request.url);
  const targetUrl = new URL(`https://www.jiosaavn.com/${context.params.path?.join('/') || 'api.php'}${url.search}`);

  const headers = new Headers(context.request.headers);
  headers.set('Host', 'www.jiosaavn.com');
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36');
  headers.set('Cookie', 'explicit_content=1');

  try {
    const res = await fetch(targetUrl.toString(), {
      method: context.request.method,
      headers,
    });

    const responseHeaders = new Headers(res.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

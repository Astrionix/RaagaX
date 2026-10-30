interface CloudflareContext {
  request: Request;
  env?: unknown;
}

export async function onRequest(context: CloudflareContext): Promise<Response> {
  const url = new URL(context.request.url);
  const target = url.searchParams.get('url');

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing url query parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const fetchRes = await fetch(target, {
      method: context.request.method || 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'Raaga-Web-AddonProxy/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const body = await fetchRes.arrayBuffer();
    return new Response(body, {
      status: fetchRes.status,
      headers: {
        'Content-Type': fetchRes.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Addon proxy request failed: ${message}` }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

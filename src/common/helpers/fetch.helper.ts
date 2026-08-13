import { userAgents, type Endpoints } from '#common/constants'
import type { ApiContextEnum } from '#common/enums'

type EndpointValue = (typeof Endpoints)[keyof typeof Endpoints]

interface FetchParams {
  endpoint: EndpointValue
  params: Record<string, string | number>
  context?: ApiContextEnum
  timeoutMs?: number
}

interface FetchResponse<T> {
  data: T
  ok: Response['ok']
}

const DEFAULT_TIMEOUT_MS = 30_000;

export const apiFetch = async <T>({ endpoint, params, context, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchParams): Promise<FetchResponse<T>> => {
  const url = new URL('https://www.jiosaavn.com/api.php')

  url.searchParams.append('__call', endpoint.toString())
  url.searchParams.append('_format', 'json')
  url.searchParams.append('_marker', '0')
  url.searchParams.append('api_version', '4')
  url.searchParams.append('ctx', context || 'web6dot0')

  Object.keys(params).forEach((key) => url.searchParams.append(key, String(params[key])))

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', 'User-Agent': randomUserAgent },
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    // AbortError means our timeout fired — return null gracefully so callers can 404 cleanly
    if (err instanceof Error && err.name === 'AbortError') {
      return { data: null as unknown as T, ok: false };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  // Guard: JioSaavn occasionally returns an HTML error page instead of JSON
  // (content-type can be text/plain, text/javascript, etc. even for valid JSON).
  // We parse defensively: if the body starts with '<' it's HTML, not JSON.
  let data: T;
  try {
    const text = await response.text();
    if (text.trimStart().startsWith('<')) {
      // HTML error page — treat as a failed fetch
      return { data: null as unknown as T, ok: false };
    }
    data = JSON.parse(text) as T;
  } catch {
    return { data: null as unknown as T, ok: false };
  }

  return { data, ok: response.ok }
}


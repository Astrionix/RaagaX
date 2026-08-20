import { userAgents, type Endpoints } from '#common/constants'
import type { ApiContextEnum } from '#common/enums'

type EndpointValue = (typeof Endpoints)[keyof typeof Endpoints]

interface FetchParams {
  endpoint: EndpointValue
  params: Record<string, string | number>
  context?: ApiContextEnum
  timeoutMs?: number
  cookieLanguage?: string
}

interface FetchResponse<T> {
  data: T
  ok: Response['ok']
}

const DEFAULT_TIMEOUT_MS = 30_000;

export const apiFetch = async <T>({ endpoint, params, context, timeoutMs = DEFAULT_TIMEOUT_MS, cookieLanguage }: FetchParams): Promise<FetchResponse<T>> => {
  const url = new URL('https://www.jiosaavn.com/api.php')

  url.searchParams.append('__call', endpoint.toString())
  url.searchParams.append('_format', 'json')
  url.searchParams.append('_marker', '0')
  url.searchParams.append('api_version', '4')
  url.searchParams.append('ctx', context || 'web6dot0')

  Object.keys(params).forEach((key) => url.searchParams.append(key, String(params[key])))

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

  const langParam = params.language ? String(params.language).toLowerCase() : null;
  const targetCookieLang = cookieLanguage || langParam || 'english,hindi,telugu,tamil,kannada,malayalam,punjabi,marathi,gujarati,bengali,bhojpuri,haryanvi';

  let response: Response;
  let text = '';
  
  for (let attempt = 0; attempt < 2; attempt++) {
    const ua = attempt === 0 ? randomUserAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': ua,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.jiosaavn.com/',
          'Cookie': `L=${encodeURIComponent(targetCookieLang)}; gdpr_acceptance=true; DL=english;`
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      text = await response.text();
      if (!text.trimStart().startsWith('<')) {
        break; // Successfully got JSON
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      if (attempt === 1) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { data: null as unknown as T, ok: false };
        }
        throw err;
      }
    }
  }

  // Parse defensively: if the body starts with '<' it's HTML, not JSON.
  let data: T;
  try {
    if (!text || text.trimStart().startsWith('<')) {
      return { data: null as unknown as T, ok: false };
    }
    data = JSON.parse(text) as T;
  } catch {
    return { data: null as unknown as T, ok: false };
  }

  return { data, ok: (response!?.ok ?? false) }
}


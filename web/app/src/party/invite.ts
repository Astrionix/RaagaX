/**
 * Party invites (JamInviteLink.kt): `https://web.raaga.me/invite/<CODE>`, `https://raaga.app/invite/<CODE>`,
 * optionally `?server=<custom server>`, `raaga://party/<CODE>`, and direct LAN format `CODE@IP:PORT`.
 * On the web the first is a route of this app (`/invite/:code`).
 */

export const INVITE_ORIGIN = 'https://web.raaga.me';
export const LEGACY_INVITE_ORIGIN = 'https://raaga.me';
export const CODE_LENGTH = 6;
export const DEFAULT_LOCAL_JAM_PORT = 8890;

/** Checks whether a hostname or IP address is a local LAN / loopback address. */
export function isLocalAddress(host: string): boolean {
  const h = host.toLowerCase().trim();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)
  );
}

/** Letters and digits only, upper case; null unless it's six of them. */
export function cleanCode(raw: string): string | null {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.length === CODE_LENGTH ? cleaned : null;
}

/** Normalizes and sanitizes server URLs, automatically handling LAN IPs with http:// and port 8890. */
export function sanitizeServerUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  let withScheme = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    const hostOnly = trimmed.split('/')[0]?.split(':')[0] || '';
    withScheme = isLocalAddress(hostOnly) ? `http://${trimmed}` : `https://${trimmed}`;
  }

  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    // Default local Wi-Fi Jam hosts to port 8890 if omitted
    if (isLocalAddress(url.hostname) && !url.port && url.protocol === 'http:') {
      url.port = String(DEFAULT_LOCAL_JAM_PORT);
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Parses user input into a party code and server URL.
 * Supports:
 * 1. Direct LAN format: CODE@IP or CODE@IP:PORT (e.g. ABC123@192.168.1.15:8890 or ABC123@localhost)
 * 2. Full invite URL: https://web.raaga.me/invite/ABC123?server=http://192.168.1.15:8890
 * 3. Custom scheme: raaga://party/ABC123?server=...
 * 4. Plain 6-digit code: ABC123
 */
export function parseCodeAndServer(value: string): { code: string | null; serverUrl: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { code: null, serverUrl: null };

  // 0. Direct CODE@IP or CODE@IP:PORT format (parity with Android JamInviteLink.kt)
  if (trimmed.includes('@')) {
    const [partCode, partServer] = trimmed.split('@', 2);
    const code = cleanCode(partCode ?? '');
    const serverUrl = sanitizeServerUrl(partServer);
    return { code, serverUrl };
  }

  // 1. Full invite URL or scheme
  const parsed = parseInvite(trimmed);
  if (parsed) return { code: parsed.code, serverUrl: parsed.serverUrl };

  // 2. Plain code
  return { code: cleanCode(trimmed), serverUrl: null };
}

export function parseInvite(value: string): { code: string; serverUrl: string | null } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const server = sanitizeServerUrl(url.searchParams.get('server'));
  if (url.protocol === 'raaga:' && url.host.toLowerCase() === 'party') {
    const code = cleanCode(url.pathname.replace(/^\/+|\/+$/g, '') || url.searchParams.get('code') || '');
    return code ? { code, serverUrl: server } : null;
  }
  const match = url.pathname.match(/^\/invite\/([A-Za-z0-9]{6})$/);
  if ((url.protocol === 'https:' || url.protocol === 'http:') && match) {
    return { code: match[1]!.toUpperCase(), serverUrl: server };
  }
  return null;
}

/** The link to share (JamInviteLink.url): a custom or local server's own invite, else the public site's. */
export function inviteUrl(code: string, customServer: string | null): string {
  const base = customServer?.trim().replace(/\/+$/, '');
  if (base) {
    try {
      const url = new URL(base.startsWith('http') ? base : `http://${base}`);
      if (isLocalAddress(url.hostname)) {
        return `${INVITE_ORIGIN}/invite/${code.toUpperCase()}?server=${encodeURIComponent(base)}`;
      }
    } catch {
      // fallback
    }
  }
  const origin = base && base.toLowerCase() !== INVITE_ORIGIN && base.toLowerCase() !== LEGACY_INVITE_ORIGIN ? base : INVITE_ORIGIN;
  return `${origin}/invite/${code.toUpperCase()}`;
}

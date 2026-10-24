/** The web player's production origin. */
export const PRODUCTION_ORIGIN = 'https://raagaweb.pages.dev';

/** The same site at its Cloudflare Pages address (the production branch's deploy). */
const PAGES_ORIGIN = 'https://raagaweb.pages.dev';

const LEGACY_PAGES_ORIGIN = 'https://bitchord-8bw.pages.dev';
const LEGACY_PROD_ORIGIN = 'https://bitchord.in';

/** The Vite dev server (web/app/vite.config.ts pins the port). */
const DEV_ORIGIN = 'http://localhost:5173';

/**
 * The web app origins this extension serves. Every message is checked against
 * this list, and it becomes externally_connectable (Chromium), the relay's
 * content-script matches (Firefox) and the DNR rules' initiatorDomains.
 */
export const SITE_ORIGINS: string[] = (
  process.env.BITCHORD_SITE_ORIGINS ??
  [
    PRODUCTION_ORIGIN,
    PAGES_ORIGIN,
    LEGACY_PAGES_ORIGIN,
    LEGACY_PROD_ORIGIN,
    ...(process.env.BITCHORD_STORE_BUILD === '1' ? [] : [DEV_ORIGIN, 'http://localhost:4173', 'http://localhost:3000']),
  ].join(',')
)
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

/**
 * Match patterns can't carry a port, so `http://localhost:5173` becomes
 * `http://localhost/*`. The exact origin, port included, is still enforced at
 * runtime against SITE_ORIGINS.
 */
export function matchPatternsFor(origins: string[]): string[] {
  return [...new Set(origins.map((o) => {
    const url = new URL(o);
    return `${url.protocol}//${url.hostname}/*`;
  }))];
}

/** The web player's production origin. */
export const PRODUCTION_ORIGIN = 'https://raaga.app';

/** The same site at its Cloudflare Pages address (the production branch's deploy). */
const PAGES_ORIGIN = 'https://raagaweb.pages.dev';

/** The Vite dev server (web/app/vite.config.ts pins the port). */
const DEV_ORIGIN = 'http://localhost:5173';

/**
 * The web app origins this extension serves. Every message is checked against
 * this list, and it becomes externally_connectable (Chromium), the relay's
 * content-script matches (Firefox) and the DNR rules' initiatorDomains.
 *
 * raaga.app and its pages.dev address always, and the dev server too except in a store build
 * (RAAGA_STORE_BUILD=1), so a published extension never answers a page on
 * localhost. RAAGA_SITE_ORIGINS (comma-separated) replaces the list. The
 * first origin is the one the popup and homepage_url link to.
 */
export const SITE_ORIGINS: string[] = (
  process.env.RAAGA_SITE_ORIGINS ??
  [PRODUCTION_ORIGIN, PAGES_ORIGIN, ...(process.env.RAAGA_STORE_BUILD === '1' ? [] : [DEV_ORIGIN])].join(',')
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

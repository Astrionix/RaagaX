/**
 * API Configuration & Base URL Resolver
 *
 * Ensures network requests from the Android APK (where origin is https://localhost)
 * resolve to the hosted RaagaX backend when online, while supporting standard
 * relative requests in web/dev environments.
 */

export const RENDER_COORDINATOR_HTTP = 'https://raagax.onrender.com';
export const RENDER_COORDINATOR_WS = 'wss://raagax.onrender.com';

export function getSyncWebSocketUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const custom = localStorage.getItem('rx_sync_ws_url');
      if (custom && custom.trim()) {
        return custom.trim();
      }
    } catch {}
  }
  return process.env.NEXT_PUBLIC_SYNC_WS_URL || RENDER_COORDINATOR_WS;
}

export function getConnectApiBaseUrl(): string {
  // Connect and Jam REST endpoints (/api/connect/*, /api/jam/*) are hosted
  // in Next.js, NOT on the Render raw WebSocket server. Always route them
  // to the Next.js API base.
  return getApiBaseUrl();
}

export const PRODUCTION_DOMAIN = 'https://raaga.me';
export const WORKERS_DEV_URL = 'https://raaga.me';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // 1. Check custom configured server override from user settings or dev tunnel
    // Note: Never use *.onrender.com for HTTP API requests since Render only hosts the WebSocket coordinator
    try {
      const custom = localStorage.getItem('rx_custom_api_base') || localStorage.getItem('raagax_connect_server_url');
      if (custom && custom.trim() && !custom.includes('onrender.com')) {
        return custom.trim().replace(/\/+$/, '');
      }
    } catch {}

    const origin = window.location.origin || '';

    // If running in any standard web browser (e.g. https://raaga.me, localhost, custom domain):
    // Always use same-origin to prevent Mixed Content (HTTPS -> HTTP) and CORS errors
    const isNativeCapacitor = Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      (window as any).androidBridge ||
      origin.startsWith('capacitor:') ||
      origin.startsWith('file:') ||
      origin === 'https://localhost' ||
      origin === 'http://localhost'
    );

    if (!isNativeCapacitor && origin) {
      return origin;
    }

    // In Capacitor Android/iOS Native APK:
    // Route to custom domain https://raaga.me (or fallback)
    return process.env.NEXT_PUBLIC_API_BASE_URL || PRODUCTION_DOMAIN;
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || PRODUCTION_DOMAIN;
}

export function getApiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  const base = getApiBaseUrl().replace(/\/+$/, '');
  return `${base}${cleanPath}`;
}

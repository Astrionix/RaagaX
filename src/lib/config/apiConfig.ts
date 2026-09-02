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
  if (typeof window !== 'undefined') {
    try {
      const custom = localStorage.getItem('rx_custom_api_base') || localStorage.getItem('raagax_connect_server_url');
      if (custom && custom.trim()) {
        return custom.trim().replace(/\/+$/, '');
      }
    } catch {}

    const origin = window.location.origin || '';
    // In local development, prefer local server if running on port 3000
    if (origin.includes('localhost:3000') || origin.includes('127.0.0.1:3000')) {
      return origin;
    }
  }

  // On Cloudflare Workers and Native Android/iOS APK:
  // Route stateful Connect & Jam rooms through the dedicated 24/7 Render coordinator
  return process.env.NEXT_PUBLIC_CONNECT_SERVER_URL || RENDER_COORDINATOR_HTTP;
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // 1. Check custom configured server override from user settings or dev tunnel
    try {
      const custom = localStorage.getItem('rx_custom_api_base') || localStorage.getItem('raagax_connect_server_url');
      if (custom && custom.trim()) {
        return custom.trim().replace(/\/+$/, '');
      }
    } catch {}

    const origin = window.location.origin || '';

    // If running in any standard web browser (e.g. https://raaga-x-chi.vercel.app, localhost, custom domain):
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
    // Route to hosted HTTPS production backend
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://raagax.padalalmrreddy.workers.dev';
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://raagax.padalalmrreddy.workers.dev';
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

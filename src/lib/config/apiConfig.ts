/**
 * API Configuration & Base URL Resolver
 *
 * Ensures network requests from the Android APK (where origin is https://localhost)
 * resolve to the hosted RaagaX backend when online, while supporting standard
 * relative requests in web/dev environments.
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
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
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://raaga-x-chi.vercel.app';
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://raaga-x-chi.vercel.app';
}

export function getApiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

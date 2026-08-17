/**
 * API Configuration & Base URL Resolver
 *
 * Ensures network requests from the Android APK (where origin is https://localhost)
 * resolve to the hosted RaagaX backend when online, while supporting standard
 * relative requests in web/dev environments.
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const isCapacitor = Boolean(
      (window as any).Capacitor ||
      origin.startsWith('capacitor:') ||
      origin.startsWith('file:') ||
      (origin.includes('localhost') && !(window as any).__NEXT_DEV__)
    );

    // In web dev environment (e.g. localhost:3000 running Next.js dev server), use local origin
    if (origin.includes('localhost:3000') || origin.includes('localhost:3001')) {
      return origin;
    }

    // In Capacitor Android/iOS WebView where origin is https://localhost
    if (isCapacitor) {
      return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://raaga-x-chi.vercel.app';
    }

    // In standard browser deployment (e.g. https://raaga-x-chi.vercel.app)
    if (origin && !origin.includes('localhost')) {
      return origin;
    }
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

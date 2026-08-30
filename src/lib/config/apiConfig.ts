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

    // In web dev environment (e.g. localhost:3000 running Next.js dev server), use local origin
    if (origin.includes('localhost:3000') || origin.includes('localhost:3001') || origin.includes('127.0.0.1:3000')) {
      return origin;
    }

    try {
      const custom = localStorage.getItem('raagax_api_base_url');
      if (custom) return custom;
    } catch {}

    const isCapacitor = Boolean(
      (window as any).Capacitor ||
      (window as any).androidBridge ||
      origin.startsWith('capacitor:') ||
      origin.startsWith('file:') ||
      origin === 'https://localhost' ||
      origin === 'http://localhost' ||
      (origin.includes('localhost') && !(window as any).__NEXT_DEV__)
    );

    // In Capacitor Android/iOS WebView where origin is https://localhost
    if (isCapacitor) {
      return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://192.168.29.99:3000';
    }

    // In standard browser deployment (e.g. https://raaga-x-chi.vercel.app)
    if (origin && !origin.includes('localhost')) {
      return origin;
    }
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://192.168.29.99:3000';
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

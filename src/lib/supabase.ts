/**
 * Supabase client — safe boundary.
 *
 * Server-side: uses SUPABASE_SERVICE_ROLE_KEY (never exposed to browser).
 * Client-side: uses NEXT_PUBLIC_SUPABASE_ANON_KEY.
 *
 * If credentials are missing (local dev without Supabase), a stub client
 * is returned that logs warnings instead of throwing. This keeps the app
 * bootable without Supabase configured.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function createStubClient(): SupabaseClient {
  // Returns a proxy that logs a warning on every DB call instead of crashing
  return new Proxy({} as SupabaseClient, {
    get(_t, prop) {
      if (prop === 'auth') {
        return new Proxy({} as any, {
          get(_t2, p2) {
            return async () => {
              console.warn(`[Supabase] Auth.${String(p2)} called but Supabase is not configured.`);
              return { data: { session: null, user: null }, error: { message: 'Supabase not configured' } };
            };
          }
        });
      }
      return (..._args: any[]) => {
        const stub = {
          select: () => stub, insert: () => stub, update: () => stub,
          upsert: () => stub, delete: () => stub, eq: () => stub,
          on: () => stub, subscribe: (cb?: any) => { if (typeof cb === 'function') cb('SUBSCRIBED'); return stub; },
          single: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
          then: (resolve: any) => resolve({ data: null, error: { message: 'Supabase not configured' } }),
          order: () => stub, limit: () => stub, match: () => stub,
        };
        console.warn(`[Supabase] .${String(prop)}() called but Supabase is not configured.`);
        return stub;
      };
    }
  });
}

const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Quota exceeded: Evict non-essential volatile RaagaX caches to free up localStorage
      try {
        const transientPrefixes = [
          'raagax_feed_',
          'raagax_artist_image_cache',
          'raagax_active_queue_snapshot',
          'raagax_taste_',
          'raagax_search_history',
          'recap_snapshot_',
        ];
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i);
          if (k && transientPrefixes.some((p) => k.startsWith(p))) {
            window.localStorage.removeItem(k);
          }
        }
        window.localStorage.setItem(key, value);
      } catch {
        // Fallback to sessionStorage if localStorage remains full
        try {
          window.sessionStorage.setItem(key, value);
        } catch {}
      }
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {}
  },
};

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qbqnlmfdmfayeztagvkj.supabase.co';
  // Server uses service role; browser uses anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFicW5sbWZkbWZheWV6dGFndmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMDAzNDksImV4cCI6MjEwMTc3NjM0OX0.Xjj4PQmu1LLYu7Yk0XiijVEDqzd4PqSsZzACaKkWLXk';

  if (!url || !key || url.includes('dummy') || key === 'dummy') {
    console.warn('[Supabase] Credentials not configured — running in stub mode. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    _client = createStubClient();
    return _client;
  }

  _client = createClient(url, key, {
    auth: {
      storage: safeStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      // Bypasses Next.js patched fetch caching on server-side environments
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

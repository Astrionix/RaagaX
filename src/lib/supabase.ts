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

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Server uses service role; browser uses anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('dummy') || key === 'dummy') {
    console.warn('[Supabase] Credentials not configured — running in stub mode. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    _client = createStubClient();
    return _client;
  }

  _client = createClient(url, key, {
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

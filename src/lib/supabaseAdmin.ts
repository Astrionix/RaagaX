import { createClient, SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null = null;

function createStubAdminClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_t, prop) {
      return (..._args: any[]) => {
        const stub: any = {
          select: () => stub, insert: () => stub, update: () => stub,
          upsert: () => stub, delete: () => stub, eq: () => stub,
          in: () => stub, gt: () => stub, lt: () => stub,
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
          then: (resolve: any) => resolve({ data: null, error: null }),
          order: () => stub, limit: () => stub,
        };
        return stub;
      };
    }
  });
}

export function getSupabaseAdmin(): SupabaseClient {
  if (instance) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qbqnlmfdmfayeztagvkj.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFicW5sbWZkbWZheWV6dGFndmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMDAzNDksImV4cCI6MjEwMTc3NjM0OX0.Xjj4PQmu1LLYu7Yk0XiijVEDqzd4PqSsZzACaKkWLXk';

  if (!url || !key || url.includes('dummy') || key === 'dummy') {
    instance = createStubAdminClient();
    return instance;
  }

  instance = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // Bypasses Next.js patched fetch caching on server-side environments
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });

  return instance;
}

// Admin client proxy deferring createClient execution to runtime
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

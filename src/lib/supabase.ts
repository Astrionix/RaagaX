import { createClient, SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (instance) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!key) {
    throw new Error('Missing SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  instance = createClient(url, key);
  return instance;
}

// Client proxy deferring createClient execution to runtime
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

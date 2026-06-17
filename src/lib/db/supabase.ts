import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url) throw new Error('SUPABASE_URL is not set');

  const key = serviceKey || anonKey;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set');

  client = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  return client;
}

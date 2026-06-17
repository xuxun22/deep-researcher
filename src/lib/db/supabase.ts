import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config/env';
import type { Database } from './types';

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (client) return client;

  const url = config.supabase.url();
  const serviceKey = config.supabase.serviceKey();
  const anonKey = config.supabase.anonKey();
  const key = serviceKey ?? anonKey;

  client = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  return client;
}

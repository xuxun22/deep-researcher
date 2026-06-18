import { getSupabaseClient } from '../supabase';
import type { ResearchSession, Json } from '../types';

export async function createSession(data: {
  user_id: string;
  query: string;
  intent?: string;
  keywords?: Json;
  trigger_type?: 'manual' | 'scheduled';
  schedule_id?: string;
  model?: string;
  config?: Json;
}): Promise<ResearchSession> {
  const supabase = getSupabaseClient();
  const { data: session, error } = await supabase
    .from('research_sessions')
    .insert({
      user_id: data.user_id,
      query: data.query,
      intent: data.intent ?? null,
      keywords: data.keywords ?? null,
      trigger_type: data.trigger_type ?? 'manual',
      schedule_id: data.schedule_id ?? null,
      model: data.model ?? null,
      config: data.config ?? {},
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return session;
}

export async function updateSessionStatus(
  id: string,
  status: ResearchSession['status'],
  extra?: { intent?: string; keywords?: Json; completed_at?: string }
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('research_sessions')
    .update({ status, ...extra })
    .eq('id', id);

  if (error) throw error;
}

export async function getSession(id: string): Promise<ResearchSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('research_sessions')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function listSessions(params: {
  user_id: string;
  limit?: number;
  offset?: number;
  status?: ResearchSession['status'];
}): Promise<{ sessions: ResearchSession[]; total: number }> {
  const supabase = getSupabaseClient();
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  let query = supabase
    .from('research_sessions')
    .select('*', { count: 'exact' })
    .eq('user_id', params.user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { sessions: data ?? [], total: count ?? 0 };
}

export async function getSessionsByIds(ids: string[]): Promise<ResearchSession[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('research_sessions')
    .select()
    .in('id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getSessionsForTrendAnalysis(params: {
  user_id: string;
  days?: number;
  limit?: number;
  query?: string;
}): Promise<ResearchSession[]> {
  const supabase = getSupabaseClient();
  const days = params.days ?? 30;
  const limit = params.limit ?? 100;

  const since = new Date();
  since.setDate(since.getDate() - days);

  let dbQuery = supabase
    .from('research_sessions')
    .select()
    .eq('user_id', params.user_id)
    .eq('status', 'done')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.query) {
    dbQuery = dbQuery.eq('query', params.query);
  }

  const { data, error } = await dbQuery;

  if (error) throw error;
  return data ?? [];
}

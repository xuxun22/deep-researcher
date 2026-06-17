import { getSupabaseClient } from '../supabase';
import type { Source } from '../types';

export async function insertSources(sources: Array<{
  session_id: string;
  url: string;
  title?: string;
  domain?: string;
  domain_score?: number;
  ai_score?: number;
  total_score?: number;
  content_text?: string;
  language?: string;
  published_at?: string;
  is_used?: boolean;
}>): Promise<Source[]> {
  if (sources.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sources')
    .insert(sources.map(s => ({
      session_id: s.session_id,
      url: s.url,
      title: s.title ?? null,
      domain: s.domain ?? null,
      domain_score: s.domain_score ?? null,
      ai_score: s.ai_score ?? null,
      total_score: s.total_score ?? null,
      content_text: s.content_text ?? null,
      language: s.language ?? null,
      published_at: s.published_at ?? null,
      is_used: s.is_used ?? false,
    })))
    .select();

  if (error) throw error;
  return data ?? [];
}

export async function updateSource(id: string, updates: {
  domain_score?: number;
  ai_score?: number;
  total_score?: number;
  content_text?: string;
  is_used?: boolean;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('sources').update(updates).eq('id', id);
  if (error) throw error;
}

export async function getSourcesBySession(sessionId: string): Promise<Source[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sources')
    .select()
    .eq('session_id', sessionId)
    .order('total_score', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getUsedSourcesBySession(sessionId: string): Promise<Source[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sources')
    .select()
    .eq('session_id', sessionId)
    .eq('is_used', true)
    .order('total_score', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getDomainStats(userId: string, days: number = 30): Promise<Array<{
  domain: string;
  usage_count: number;
  avg_score: number;
}>> {
  const supabase = getSupabaseClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: sessions } = await supabase
    .from('research_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'done')
    .gte('created_at', since.toISOString());

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);
  const { data, error } = await supabase
    .from('sources')
    .select('domain, total_score')
    .in('session_id', sessionIds)
    .not('domain', 'is', null);

  if (error) throw error;
  if (!data) return [];

  const domainMap = new Map<string, { count: number; totalScore: number }>();
  for (const row of data) {
    const domain = row.domain!;
    const existing = domainMap.get(domain) ?? { count: 0, totalScore: 0 };
    existing.count++;
    existing.totalScore += row.total_score ?? 0;
    domainMap.set(domain, existing);
  }

  return Array.from(domainMap.entries()).map(([domain, stats]) => ({
    domain,
    usage_count: stats.count,
    avg_score: stats.totalScore / stats.count,
  }));
}

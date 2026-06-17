import { getSupabaseClient } from '../supabase';
import type { TrendAnalysis, Json } from '../types';

export async function insertTrendAnalysis(data: {
  user_id: string;
  analysis_type: string;
  scope_query?: string;
  session_count?: number;
  input_summary?: Json;
  result: Json;
}): Promise<TrendAnalysis> {
  const supabase = getSupabaseClient();
  const { data: analysis, error } = await supabase
    .from('trend_analyses')
    .insert({
      user_id: data.user_id,
      analysis_type: data.analysis_type,
      scope_query: data.scope_query ?? null,
      session_count: data.session_count ?? null,
      input_summary: data.input_summary ?? null,
      result: data.result,
    })
    .select()
    .single();

  if (error) throw error;
  return analysis;
}

export async function getTrendAnalysis(id: string): Promise<TrendAnalysis | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('trend_analyses')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function listTrendAnalyses(params: {
  user_id: string;
  analysis_type?: string;
  limit?: number;
  offset?: number;
}): Promise<{ analyses: TrendAnalysis[]; total: number }> {
  const supabase = getSupabaseClient();
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  let query = supabase
    .from('trend_analyses')
    .select('*', { count: 'exact' })
    .eq('user_id', params.user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.analysis_type) {
    query = query.eq('analysis_type', params.analysis_type);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { analyses: data ?? [], total: count ?? 0 };
}

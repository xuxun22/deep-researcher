import { getSupabaseClient } from '../supabase';
import type { Summary, Json } from '../types';

export async function insertSummary(data: {
  session_id: string;
  content: string;
  language?: string;
  citations?: Json;
  confidence?: number;
  gaps?: Json;
}): Promise<Summary> {
  const supabase = getSupabaseClient();
  const { data: summary, error } = await supabase
    .from('summaries')
    .insert({
      session_id: data.session_id,
      content: data.content,
      language: data.language ?? 'zh',
      citations: data.citations ?? null,
      confidence: data.confidence ?? null,
      gaps: data.gaps ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return summary;
}

export async function getSummaryBySession(sessionId: string): Promise<Summary | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('summaries')
    .select()
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

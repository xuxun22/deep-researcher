import { getSupabaseClient } from '../supabase';
import type { ResearchSchedule, Json } from '../types';

export async function createSchedule(data: {
  user_id: string;
  name: string;
  query: string;
  cron_expr: string;
  model?: string;
  config?: Json;
}): Promise<ResearchSchedule> {
  const supabase = getSupabaseClient();
  const { data: schedule, error } = await supabase
    .from('research_schedules')
    .insert({
      user_id: data.user_id,
      name: data.name,
      query: data.query,
      cron_expr: data.cron_expr,
      model: data.model ?? 'claude-sonnet-4-6',
      config: data.config ?? {},
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return schedule;
}

export async function updateSchedule(id: string, updates: {
  name?: string;
  query?: string;
  cron_expr?: string;
  model?: string;
  is_active?: boolean;
  next_run_at?: string;
  last_run_at?: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('research_schedules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('research_schedules').delete().eq('id', id);
  if (error) throw error;
}

export async function getSchedule(id: string): Promise<ResearchSchedule | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('research_schedules')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function listSchedules(userId: string): Promise<ResearchSchedule[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('research_schedules')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getDueSchedules(): Promise<ResearchSchedule[]> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('research_schedules')
    .select()
    .eq('is_active', true)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

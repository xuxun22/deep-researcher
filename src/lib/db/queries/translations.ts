import { getSupabaseClient } from '../supabase';
import type { Translation, Json } from '../types';

export async function insertTranslation(data: {
  session_id: string;
  original_text: string;
  translated: string;
  original_language?: string | null;
  glossary?: Json;
}): Promise<Translation> {
  const supabase = getSupabaseClient();
  const { data: translation, error } = await supabase
    .from('translations')
    .insert({
      session_id: data.session_id,
      original_text: data.original_text,
      translated: data.translated,
      original_language: data.original_language ?? null,
      glossary: data.glossary ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return translation;
}

export async function getTranslationBySession(sessionId: string): Promise<Translation | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('translations')
    .select()
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

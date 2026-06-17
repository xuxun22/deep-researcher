import { config } from '@/lib/config/env';

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    config.anthropic.apiKey();
    checks.anthropic = 'ok';
  } catch { checks.anthropic = 'missing'; }

  checks.anthropicBaseUrl = config.anthropic.baseUrl() ?? 'default';
  checks.anthropicModel = config.anthropic.model() ?? config.defaultModel;

  try {
    config.tavily.apiKey();
    checks.tavily = 'ok';
  } catch { checks.tavily = 'missing'; }

  try {
    config.supabase.url();
    checks.supabaseUrl = 'ok';
  } catch { checks.supabaseUrl = 'missing'; }

  try {
    config.supabase.anonKey();
    checks.supabaseKey = 'ok';
  } catch { checks.supabaseKey = 'missing'; }

  checks.supabaseServiceKey = config.supabase.serviceKey() ? 'ok' : 'missing (using anon)';

  let dbStatus = 'unknown';
  try {
    const { getSupabaseClient } = await import('@/lib/db/supabase');
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('research_sessions').select('id').limit(1);
    dbStatus = error ? `error: ${error.message}` : 'ok';
  } catch (err) {
    dbStatus = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  checks.database = dbStatus;

  return Response.json({
    status: 'ok',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
    checks,
  });
}

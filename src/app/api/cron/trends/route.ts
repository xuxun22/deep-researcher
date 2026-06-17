import { NextRequest } from 'next/server';
import { config } from '@/lib/config/env';
import { getDueSchedules } from '@/lib/db/queries/schedules';
import { getSessionsForTrendAnalysis } from '@/lib/db/queries/sessions';
import { insertTrendAnalysis } from '@/lib/db/queries/trends';
import { getSkillRegistry } from '@/core/skill-registry';
import { runSkill } from '@/core/skill-runner';
import type { SkillContext } from '@/core/skill-types';
import { getTavilyClient } from '@/lib/search/tavily-client';
import { getDomainRules } from '@/lib/authority/domain-rules';
import { getOrCreateSandbox, cleanupSandbox } from '@/lib/sandbox/manager';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = config.cron.secret();

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = body.userId ?? 'system';

  const sessions = await getSessionsForTrendAnalysis({ user_id: userId, days: 30, limit: 100 });

  if (sessions.length < 5) {
    return Response.json({
      message: 'Insufficient data for trend analysis',
      sessionCount: sessions.length,
    });
  }

  const sandbox = await getOrCreateSandbox('trend-analysis');

  try {
    const registry = await getSkillRegistry();

    const ctx: SkillContext = {
      sandbox,
      model: config.defaultModel,
      tavilyClient: getTavilyClient(),
      domainRules: getDomainRules(),
      signal: new AbortController().signal,
      userId,
    };

    let result = '';
    for await (const event of runSkill({
      skill: registry.get('trend-analyze')!,
      input: {
        userId,
        sessions: sessions.map(s => ({
          id: s.id,
          query: s.query,
          intent: s.intent,
          keywords: s.keywords,
          created_at: s.created_at,
        })),
        analysisType: 'comprehensive',
        days: 30,
      },
      ctx,
      allowedTools: ['Read'],
    })) {
      if (event.type === 'skill_result') {
        result = (event.data as { result?: string }).result ?? '';
      }
    }

    let parsedResult: Record<string, unknown> = {};
    try { parsedResult = JSON.parse(result); } catch {}

    await insertTrendAnalysis({
      user_id: userId,
      analysis_type: 'comprehensive',
      session_count: sessions.length,
      input_summary: { period: '30 days', sessionCount: sessions.length },
      result: parsedResult as unknown as import('@/lib/db/types').Json,
    });

    return Response.json({ success: true, sessionCount: sessions.length });
  } finally {
    await cleanupSandbox(sandbox.sandbox);
  }
}

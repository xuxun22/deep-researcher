import { NextRequest } from 'next/server';
import { createSSEStream } from '@/lib/stream/sse';
import { getSessionsForTrendAnalysis } from '@/lib/db/queries/sessions';
import { getSkillRegistry } from '@/core/skill-registry';
import { runSkill } from '@/core/skill-runner';
import type { SkillContext } from '@/core/skill-types';
import { getTavilyClient } from '@/lib/search/tavily-client';
import { getDomainRules } from '@/lib/authority/domain-rules';
import { config } from '@/lib/config/env';
import { insertTrendAnalysis } from '@/lib/db/queries/trends';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const offset = parseInt(searchParams.get('offset') ?? '0');
  const analysisType = searchParams.get('type') ?? undefined;

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const { listTrendAnalyses } = await import('@/lib/db/queries/trends');
  const result = await listTrendAnalyses({ user_id: userId, analysis_type: analysisType, limit, offset });
  return Response.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, days = 30, analysisType = 'comprehensive', query } = body;

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const { stream, send, close, error } = createSSEStream();

  (async () => {
    try {
      const sessions = await getSessionsForTrendAnalysis({ user_id: userId, days, limit: 100, query });

      send({ type: 'phase', data: { phase: 'trend_analysis', sessionCount: sessions.length, scope: query || 'all' } });

      if (sessions.length < 2) {
        send({ type: 'error', data: { message: `Need at least 2 sessions for trend analysis (topic: "${query || 'all'}")` } });
        close();
        return;
      }

      const registry = await getSkillRegistry();
      const ctx: SkillContext = {
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
            id: s.id, query: s.query, intent: s.intent,
            keywords: s.keywords, created_at: s.created_at,
          })),
          analysisType,
          days,
          scopeQuery: query || undefined,
        },
        ctx,
        enabledTools: [],
      })) {
        send(event);
        if (event.type === 'skill_result') {
          result = (event.data as { result?: string }).result ?? '';
        }
      }

      let parsedResult: Record<string, unknown> = {};
      try { parsedResult = JSON.parse(result); } catch {}

      await insertTrendAnalysis({
        user_id: userId,
        analysis_type: analysisType,
        scope_query: query || null,
        session_count: sessions.length,
        input_summary: { period: `${days} days`, sessionCount: sessions.length, scopeQuery: query || 'all' },
        result: parsedResult as unknown as import('@/lib/db/types').Json,
      });

      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(message);
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

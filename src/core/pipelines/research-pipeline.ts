import { getSkillRegistry } from '@/core/skill-registry';
import { runSkill } from '@/core/skill-runner';
import type { SkillContext, SkillEvent } from '@/core/skill-types';
import { getTavilyClient } from '@/lib/search/tavily-client';
import { getDomainRules } from '@/lib/authority/domain-rules';
import { config } from '@/lib/config/env';
import {
  createSession,
  updateSessionStatus,
} from '@/lib/db/queries/sessions';
import { insertSources } from '@/lib/db/queries/sources';
import { insertSummary } from '@/lib/db/queries/summaries';
import { insertTranslation } from '@/lib/db/queries/translations';

export interface ResearchInput {
  userId: string;
  query: string;
  model?: string;
  scheduleId?: string;
  triggerType?: 'manual' | 'scheduled';
}

export interface ResearchEvent extends SkillEvent {
  type: string;
  data: unknown;
}

export async function* executeResearch(input: ResearchInput): AsyncIterable<ResearchEvent> {
  const model = input.model ?? config.defaultModel;
  const abortController = new AbortController();

  const session = await createSession({
    user_id: input.userId,
    query: input.query,
    model,
    trigger_type: input.triggerType ?? 'manual',
    schedule_id: input.scheduleId,
  });

  yield { type: 'session_created', data: { sessionId: session.id } };

  const ctx: SkillContext = {
    model,
    tavilyClient: getTavilyClient(),
    domainRules: getDomainRules(),
    signal: abortController.signal,
    sessionId: session.id,
    userId: input.userId,
  };

  try {
    const registry = await getSkillRegistry();

    yield { type: 'phase', data: { phase: 'query_understand' } };
    await updateSessionStatus(session.id, 'searching');

    const queryResult = yield* collectSkillResult(
      runSkill({
        skill: registry.get('query-understand')!,
        input: { query: input.query },
        ctx,
        enabledTools: [],
      })
    );

    let parsedQuery: { keywords?: Array<{ query: string }>; intent?: string } = {};
    try { parsedQuery = JSON.parse(queryResult); } catch {}

    await updateSessionStatus(session.id, 'searching', {
      intent: parsedQuery.intent,
      keywords: parsedQuery.keywords?.map(k => k.query) ?? [],
    });

    yield { type: 'phase', data: { phase: 'authority_evaluate' } };

    const authorityResult = yield* collectSkillResult(
      runSkill({
        skill: registry.get('authority-evaluate')!,
        input: { query: input.query, keywords: parsedQuery.keywords ?? [] },
        ctx,
        enabledTools: ['tavily', 'domain'],
      })
    );

    let parsedAuthority: { scoredSources?: Array<{ url: string; title: string; totalScore: number; domain: string }> } = {};
    try { parsedAuthority = JSON.parse(authorityResult); } catch {}

    if (parsedAuthority.scoredSources) {
      await insertSources(
        parsedAuthority.scoredSources
          .filter(s => s.totalScore >= 0.5)
          .map(s => ({
            session_id: session.id,
            url: s.url,
            title: s.title,
            domain: s.domain,
            total_score: s.totalScore,
            domain_score: s.totalScore,
          }))
      );
    }

    yield { type: 'phase', data: { phase: 'content_fetch' } };
    await updateSessionStatus(session.id, 'analyzing');

    const contentResult = yield* collectSkillResult(
      runSkill({
        skill: registry.get('content-fetch')!,
        input: {
          urls: parsedAuthority.scoredSources
            ?.filter(s => s.totalScore >= 0.5)
            .map(s => s.url) ?? [],
        },
        ctx,
        enabledTools: ['tavily'],
      })
    );

    yield { type: 'phase', data: { phase: 'summarize' } };

    const summaryResult = yield* collectSkillResult(
      runSkill({
        skill: registry.get('summarize')!,
        input: { query: input.query, contents: contentResult },
        ctx,
        enabledTools: [],
      })
    );

    let parsedSummary: { overview?: string; detailedAnalysis?: string; language?: string } = {};
    try { parsedSummary = JSON.parse(summaryResult); } catch {}

    if (parsedSummary.overview) {
      await insertSummary({
        session_id: session.id,
        content: parsedSummary.detailedAnalysis ?? parsedSummary.overview,
        language: parsedSummary.language,
      });
    }

    yield { type: 'phase', data: { phase: 'translate' } };

    const translateResult = yield* collectSkillResult(
      runSkill({
        skill: registry.get('translate')!,
        input: {
          text: summaryResult,
          sourceLanguage: parsedSummary.language ?? 'auto',
        },
        ctx,
        enabledTools: [],
      })
    );

    let parsedTranslation: { translated?: string; original_text?: string } = {};
    try { parsedTranslation = JSON.parse(translateResult); } catch {}

    if (parsedTranslation.translated) {
      await insertTranslation({
        session_id: session.id,
        original_text: parsedTranslation.original_text ?? summaryResult,
        translated: parsedTranslation.translated,
      });
    }

    await updateSessionStatus(session.id, 'done', { completed_at: new Date().toISOString() });
    yield { type: 'phase', data: { phase: 'complete' } };
    yield { type: 'result', data: { summary: summaryResult, translation: translateResult } };

  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err, null, 2)
        : String(err);
    yield { type: 'error', data: { message } };
  }
}

async function* collectSkillResult(
  events: AsyncIterable<SkillEvent>
): AsyncGenerator<SkillEvent, string, unknown> {
  let result = '';
  for await (const event of events) {
    if (event.type === 'skill_result') {
      result = (event.data as { result?: string }).result ?? '';
    }
    yield event;
  }
  return result;
}

import { getSkillRegistry } from '@/core/skill-registry'
import { runSkill } from '@/core/skill-runner'
import type { SkillContext, SkillEvent } from '@/core/skill-types'
import { getTavilyClient } from '@/lib/search/tavily-client'
import { getDomainRules } from '@/lib/authority/domain-rules'
import { config } from '@/lib/config/env'
import {
  createSession,
  updateSessionStatus,
} from '@/lib/db/queries/sessions'
import { insertSources } from '@/lib/db/queries/sources'
import { insertSummary } from '@/lib/db/queries/summaries'
import { insertTranslation } from '@/lib/db/queries/translations'

export interface ResearchInput {
  userId: string
  query: string
  model?: string
  scheduleId?: string
  triggerType?: 'manual' | 'scheduled'
}

export interface ResearchEvent extends SkillEvent {
  type: string
  data: unknown
}

export async function* executeResearch(input: ResearchInput): AsyncIterable<ResearchEvent> {
  const model = input.model ?? config.defaultModel
  const abortController = new AbortController()

  const session = await createSession({
    user_id: input.userId,
    query: input.query,
    model,
    trigger_type: input.triggerType ?? 'manual',
    schedule_id: input.scheduleId,
  })

  yield { type: 'session_created', data: { sessionId: session.id } }

  const ctx: SkillContext = {
    model,
    tavilyClient: getTavilyClient(),
    domainRules: getDomainRules(),
    signal: abortController.signal,
    sessionId: session.id,
    userId: input.userId,
  }

  try {
    const registry = await getSkillRegistry()
    const deepResearchSkill = registry.get('deep-research')

    if (!deepResearchSkill) {
      throw new Error('deep-research skill not found')
    }

    await updateSessionStatus(session.id, 'searching')

    let result = ''

    for await (const event of runSkill({
      skill: deepResearchSkill,
      input: { query: input.query },
      ctx,
      enabledTools: ['tavily', 'domain'],
    })) {
      yield event

      if (event.type === 'skill_result') {
        result = (event.data as { result?: string }).result ?? ''
      }
    }

    // Parse the final JSON result
    let parsedResult: {
      queryAnalysis?: { intent?: string; language?: string; keywords?: string[] }
      sources?: Array<{ url: string; title: string; domain: string; domainScore: number; passed: boolean }>
      summary?: { executiveSummary?: string; keyFindings?: string[]; detailedAnalysis?: string; contradictions?: string; recommendations?: string[]; critique?: string; language?: string }
      translation?: { translated?: string; originalLanguage?: string }
      thinkingLog?: string
    } = {}

    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[1])
      } else {
        parsedResult = JSON.parse(result)
      }
    } catch {
      // If parsing fails, treat the whole result as summary
      parsedResult = {
        summary: { executiveSummary: result, detailedAnalysis: result, language: 'zh' },
        translation: { translated: result, originalLanguage: 'zh' },
      }
    }

    // Fallback: extract URLs from result text if sources array is missing or empty
    if (!parsedResult.sources || parsedResult.sources.length === 0) {
      const urlMatches = result.match(/https?:\/\/[^\s\)"]+/g) || []
      if (urlMatches.length > 0) {
        parsedResult.sources = urlMatches.map(url => {
          try {
            const domain = new URL(url).hostname
            let domainScore = 0.5
            if (domain.endsWith('.edu') || domain.endsWith('.gov')) domainScore = 0.95
            else if (domain.endsWith('.org')) domainScore = 0.75
            else if (['wikipedia.org','arxiv.org','nature.com','ieee.org','acm.org','sciencedirect.com','springer.com','mit.edu','stanford.edu'].some(d => domain.includes(d))) domainScore = 0.9
            else if (['github.com','medium.com','reddit.com','twitter.com','x.com'].some(d => domain.includes(d))) domainScore = 0.4
            return { url, title: '', domain, domainScore, passed: domainScore >= 0.5 }
          } catch {
            return { url, title: '', domain: url, domainScore: 0.5, passed: true }
          }
        })
      }
    }

    // Save sources
    if (parsedResult.sources) {
      const passedSources = parsedResult.sources.filter(s => s.passed !== false)
      if (passedSources.length > 0) {
        await insertSources(
          passedSources.map(s => ({
            session_id: session.id,
            url: s.url,
            title: s.title ?? '',
            domain: s.domain ?? new URL(s.url).hostname,
            total_score: s.domainScore ?? 0.5,
            domain_score: s.domainScore ?? 0.5,
          }))
        )
      }
    }

    await updateSessionStatus(session.id, 'analyzing')

    // Save summary
    if (parsedResult.summary?.executiveSummary) {
      await insertSummary({
        session_id: session.id,
        content: parsedResult.summary.detailedAnalysis ?? parsedResult.summary.executiveSummary,
        language: parsedResult.summary.language,
      })
    }

    // Save translation
    if (parsedResult.translation?.translated) {
      await insertTranslation({
        session_id: session.id,
        original_text: parsedResult.summary?.executiveSummary ?? result,
        translated: parsedResult.translation.translated,
        original_language: parsedResult.translation.originalLanguage ?? null,
      })
    }

    await updateSessionStatus(session.id, 'done', {
      intent: parsedResult.queryAnalysis?.intent ?? undefined,
      keywords: parsedResult.queryAnalysis?.keywords ?? undefined,
      completed_at: new Date().toISOString(),
    })
    yield { type: 'phase', data: { phase: 'complete' } }
    yield { type: 'result', data: { summary: result, translation: parsedResult.translation?.translated ?? result, thinkingLog: parsedResult.thinkingLog ?? '' } }

  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err, null, 2)
        : String(err)
    yield { type: 'error', data: { message } }
  }
}

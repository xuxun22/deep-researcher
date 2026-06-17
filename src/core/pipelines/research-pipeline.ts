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

    yield { type: 'phase', data: { phase: 'query_understand' } }
    await updateSessionStatus(session.id, 'searching')

    const queryResult = yield* collectSkillResult(
      runSkill({
        skill: registry.get('query-understand')!,
        input: { query: input.query },
        ctx,
        enabledTools: [],
      })
    )

    let parsedQuery: { keywords?: Array<{ query: string }>; intent?: string } = {}
    try { parsedQuery = JSON.parse(queryResult) } catch {}

    await updateSessionStatus(session.id, 'searching', {
      intent: parsedQuery.intent,
      keywords: parsedQuery.keywords?.map(k => k.query) ?? [],
    })

    yield { type: 'phase', data: { phase: 'authority_evaluate' } }

    // Code Layer: deterministic search via Tavily (parallel)
    const keywords = parsedQuery.keywords?.map(k => k.query) ?? [input.query]
    const searchQueries = keywords.slice(0, 2) // limit to top 2 keywords for speed

    const searchPromises = searchQueries.map(async (q) => {
      try {
        const searchRes = await ctx.tavilyClient.search({ query: q, maxResults: 5 })
        return searchRes.results.map(r => ({
          url: r.url,
          title: r.title,
          content: r.content ?? '',
          score: r.score ?? 0,
        }))
      } catch {
        return []
      }
    })

    const allResults = (await Promise.all(searchPromises)).flat()

    // Deduplicate by URL and pre-rank by domain score
    const seen = new Set<string>()
    const uniqueResults = allResults
      .filter(r => {
        if (seen.has(r.url)) return false
        seen.add(r.url)
        return true
      })
      .map(r => {
        const domain = new URL(r.url).hostname
        let domainScore = 0.5
        if (domain.endsWith('.edu') || domain.endsWith('.gov')) domainScore = 0.95
        else if (domain.endsWith('.org')) domainScore = 0.75
        else if (['wikipedia.org','arxiv.org','nature.com','ieee.org','acm.org','sciencedirect.com','springer.com','mit.edu','stanford.edu'].some(d => domain.includes(d))) domainScore = 0.9
        else if (['github.com','medium.com','reddit.com','twitter.com','x.com'].some(d => domain.includes(d))) domainScore = 0.4
        return { ...r, domain, domainScore }
      })
      .sort((a, b) => b.domainScore - a.domainScore)
      .slice(0, 8) // limit to top 8 sources for agent speed

    // AI Skill: evaluate authority of sources
    const authorityResult = yield* collectSkillResult(
      runSkill({
        skill: registry.get('authority-evaluate')!,
        input: {
          query: input.query,
          sources: uniqueResults.map(r => ({
            url: r.url,
            title: r.title,
            content: r.content,
          })),
        },
        ctx,
        enabledTools: [],
      })
    )

    let parsedAuthority: { scoredSources?: Array<{ url: string; title: string; totalScore: number; domain: string }> } = {}
    try { parsedAuthority = JSON.parse(authorityResult) } catch {}

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
      )
    }

    yield { type: 'phase', data: { phase: 'content_fetch' } }
    await updateSessionStatus(session.id, 'analyzing')

    // Code Layer: deterministic content extraction via Tavily
    const passedUrls = parsedAuthority.scoredSources
      ?.filter(s => s.totalScore >= 0.5)
      .map(s => s.url) ?? []

    const extractedContents: Array<{ url: string; content: string }> = []
    if (passedUrls.length > 0) {
      try {
        const extractRes = await ctx.tavilyClient.extract(passedUrls.slice(0, 5))
        for (const r of extractRes.results) {
          if (r.raw_content) {
            extractedContents.push({ url: r.url, content: r.raw_content })
          }
        }
      } catch {
        // fallback: use search snippets as content
        for (const url of passedUrls.slice(0, 5)) {
          const r = uniqueResults.find(u => u.url === url)
          if (r) {
            extractedContents.push({ url: r.url, content: r.content })
          }
        }
      }
    }

    const contentResult = JSON.stringify({
      contents: extractedContents,
      summary: { total: extractedContents.length, success: extractedContents.length, failed: 0 },
    })

    yield { type: 'phase', data: { phase: 'summarize' } }

    const summaryResult = yield* collectSkillResult(
      runSkill({
        skill: registry.get('summarize')!,
        input: { query: input.query, contents: contentResult },
        ctx,
        enabledTools: [],
      })
    )

    let parsedSummary: { overview?: string; detailedAnalysis?: string; language?: string } = {}
    try { parsedSummary = JSON.parse(summaryResult) } catch {}

    if (parsedSummary.overview) {
      await insertSummary({
        session_id: session.id,
        content: parsedSummary.detailedAnalysis ?? parsedSummary.overview,
        language: parsedSummary.language,
      })
    }

    yield { type: 'phase', data: { phase: 'translate' } }

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
    )

    let parsedTranslation: { translated?: string; original_text?: string } = {}
    try { parsedTranslation = JSON.parse(translateResult) } catch {}

    if (parsedTranslation.translated) {
      await insertTranslation({
        session_id: session.id,
        original_text: parsedTranslation.original_text ?? summaryResult,
        translated: parsedTranslation.translated,
      })
    }

    await updateSessionStatus(session.id, 'done', { completed_at: new Date().toISOString() })
    yield { type: 'phase', data: { phase: 'complete' } }
    yield { type: 'result', data: { summary: summaryResult, translation: translateResult } }

  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err, null, 2)
        : String(err)
    yield { type: 'error', data: { message } }
  }
}

async function* collectSkillResult(
  events: AsyncIterable<SkillEvent>
): AsyncGenerator<SkillEvent, string, unknown> {
  let result = ''
  for await (const event of events) {
    if (event.type === 'skill_result') {
      result = (event.data as { result?: string }).result ?? ''
    }
    yield event
  }
  return result
}

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

function extractUrlsFromMarkdown(md: string): Array<{ url: string; title: string; domain: string; domainScore: number }> {
  const sources: Array<{ url: string; title: string; domain: string; domainScore: number }> = []
  const seen = new Set<string>()

  // Try to extract from markdown tables in Sources section
  const sourcesSection = md.match(/#\s*Sources[\s\S]*?(?=^# |\Z)/m)
  if (sourcesSection) {
    const tableRows = sourcesSection[0].match(/\|[^\n]+\|/g) || []
    for (const row of tableRows) {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean)
      if (cols.length >= 2) {
        const linkMatch = row.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (linkMatch) {
          const url = linkMatch[2]
          if (seen.has(url)) continue
          seen.add(url)
          try {
            const domain = new URL(url).hostname
            sources.push({ url, title: linkMatch[1], domain, domainScore: 0.5 })
          } catch {
            sources.push({ url, title: linkMatch[1], domain: url, domainScore: 0.5 })
          }
        }
      }
    }
  }

  // Fallback: extract all URLs
  if (sources.length === 0) {
    const urlMatches = md.match(/https?:\/\/[^\s\)"\]]+/g) || []
    for (const url of urlMatches) {
      if (seen.has(url)) continue
      seen.add(url)
      try {
        const domain = new URL(url).hostname
        sources.push({ url, title: '', domain, domainScore: 0.5 })
      } catch {
        sources.push({ url, title: '', domain: url, domainScore: 0.5 })
      }
    }
  }

  return sources
}

function extractSection(md: string, heading: string): string {
  const regex = new RegExp(`^#+\\s*${heading}\\s*\\n([\\s\\S]*?)(?=^# |\\Z)`, 'im')
  const match = md.match(regex)
  return match ? match[1].trim() : ''
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

    // Extract sources from markdown
    const sources = extractUrlsFromMarkdown(result)
    if (sources.length > 0) {
      await insertSources(
        sources.map(s => ({
          session_id: session.id,
          url: s.url,
          title: s.title,
          domain: s.domain,
          total_score: s.domainScore,
          domain_score: s.domainScore,
        }))
      )
    }

    await updateSessionStatus(session.id, 'analyzing')

    // Save the full markdown as summary
    if (result) {
      await insertSummary({
        session_id: session.id,
        content: result,
        language: 'zh',
      })
    }

    // Extract thinking log for potential translation
    const thinkingLog = extractSection(result, 'Thinking Log')

    await updateSessionStatus(session.id, 'done', {
      completed_at: new Date().toISOString(),
    })

    yield { type: 'phase', data: { phase: 'complete' } }
    yield { type: 'result', data: { summary: result, translation: '', thinkingLog } }

  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err, null, 2)
        : String(err)
    yield { type: 'error', data: { message } }
  }
}

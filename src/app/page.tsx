"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface ResearchSession {
  id: string
  user_id: string
  query: string
  intent: string | null
  keywords: string[] | null
  status: string
  model: string | null
  created_at: string
  completed_at: string | null
}

interface Source {
  id: string
  url: string
  title: string
  domain: string
  domain_score: number
  total_score: number
}

interface Summary {
  id: string
  content: string
  language: string
}

interface Translation {
  id: string
  translated: string
  original_language: string | null
}

interface HistoryItem {
  session: ResearchSession
  sources: Source[]
  summary: Summary | null
  translation: Translation | null
}

interface StreamEvent {
  type: string
  data: Record<string, unknown>
}

interface TrendAnalysis {
  id: string
  analysis_type: string
  session_count: number
  created_at: string
}

interface ModelInfo {
  id: string
  name: string
}

export default function Home() {
  const [userId, setUserId] = useState("")
  const [query, setQuery] = useState("")
  const [model, setModel] = useState("")
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([])
  const [plan, setPlan] = useState<string>("")
  const [finalResult, setFinalResult] = useState<{ report: string; sources: Source[]; thinkingLog: string } | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isTrendOpen, setIsTrendOpen] = useState(false)
  const [trendEvents, setTrendEvents] = useState<StreamEvent[]>([])
  const [isTrending, setIsTrending] = useState(false)
  const [trendResult, setTrendResult] = useState("")
  const [pastTrends, setPastTrends] = useState<TrendAnalysis[]>([])
  const [searchFilter, setSearchFilter] = useState("")
  const streamEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem("deep-researcher-userId")
    if (saved) setUserId(saved)
    else setUserId("user-" + Math.random().toString(36).slice(2, 10))
  }, [])

  useEffect(() => {
    if (userId) localStorage.setItem("deep-researcher-userId", userId)
  }, [userId])

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (d.models && typeof d.models === "object" && !Array.isArray(d.models)) {
          const entries = Object.entries(d.models).map(([id, info]) => ({
            id,
            name: (info as { name?: string }).name || id,
          }))
          setAvailableModels(entries)
          const firstKey = Object.keys(d.models)[0]
          if (firstKey) setModel(firstKey)
        } else if (d.models && Array.isArray(d.models)) {
          const entries = d.models.map((m: { id?: string; name?: string }) => ({
            id: m.id || String(m),
            name: m.name || m.id || String(m),
          }))
          setAvailableModels(entries)
          if (entries.length > 0) setModel(entries[0].id)
        }
      })
      .catch(() => {})
  }, [])

  const fetchHistory = useCallback(async () => {
    if (!userId) return
    setIsLoadingHistory(true)
    try {
      const res = await fetch(`/api/history?userId=${encodeURIComponent(userId)}&limit=50`)
      const data = await res.json()
      if (data.sessions) {
        const items: HistoryItem[] = []
        for (const session of data.sessions) {
          try {
            const detailRes = await fetch(`/api/history/${session.id}`)
            const detail = await detailRes.json()
            items.push({ session, sources: detail.sources || [], summary: detail.summary || null, translation: detail.translation || null })
          } catch {
            items.push({ session, sources: [], summary: null, translation: null })
          }
        }
        setHistory(items)
      }
    } catch (err) {
      console.error("Failed to load history:", err)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [userId])

  const fetchTrends = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/trends?userId=${encodeURIComponent(userId)}&limit=20`)
      const data = await res.json()
      if (data.analyses) setPastTrends(data.analyses)
    } catch {}
  }, [userId])

  useEffect(() => {
    fetchHistory()
    fetchTrends()
  }, [fetchHistory, fetchTrends])

  useEffect(() => {
    if (streamEndRef.current) streamEndRef.current.scrollIntoView({ behavior: "smooth" })
  }, [streamEvents])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !userId.trim() || isStreaming) return
    setIsStreaming(true)
    setStreamEvents([])
    setPlan("")
    setFinalResult(null)
    try {
      const body: Record<string, string> = { query: query.trim(), userId: userId.trim() }
      if (model) body.model = model
      const res = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body")
      const decoder = new TextDecoder()
      let buffer = ""
      let report = ""
      let thinkingLog = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data: ")) continue
          try {
            const event: StreamEvent = JSON.parse(trimmed.slice(6))
            setStreamEvents((prev) => [...prev, event])
            if (event.type === "agent_text" && !plan) {
              const ad = event.data as { text?: string }
              if (ad.text && ad.text.length > 20) setPlan(ad.text)
            }
            if (event.type === "skill_result") {
              const rd = event.data as { result?: string }
              if (rd.result) report = rd.result
            }
          } catch {}
        }
      }
      if (report) setFinalResult({ report, sources: [], thinkingLog })
      setTimeout(fetchHistory, 500)
    } catch (err) {
      setStreamEvents((prev) => [...prev, { type: "error", data: { message: err instanceof Error ? err.message : "Unknown error" } }])
    } finally {
      setIsStreaming(false)
    }
  }

  const handleTrendAnalysis = async () => {
    if (!userId.trim() || isTrending) return
    setIsTrending(true)
    setTrendEvents([])
    setTrendResult("")
    setIsTrendOpen(true)
    try {
      const res = await fetch("/api/trends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userId.trim(), days: 30 }) })
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body")
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data: ")) continue
          try {
            const event: StreamEvent = JSON.parse(trimmed.slice(6))
            setTrendEvents((prev) => [...prev, event])
            if (event.type === "skill_result") {
              const d = event.data as { result?: string }
              if (d.result) setTrendResult(d.result)
            }
          } catch {}
        }
      }
      setTimeout(fetchTrends, 500)
    } catch (err) {
      setTrendEvents((prev) => [...prev, { type: "error", data: { message: err instanceof Error ? err.message : "Unknown error" } }])
    } finally {
      setIsTrending(false)
    }
  }

  const filteredHistory = history.filter((item) => {
    const q = item.session.query.toLowerCase()
    const intent = (item.session.intent || "").toLowerCase()
    const keywords = (item.session.keywords || []).join(" ").toLowerCase()
    const f = searchFilter.toLowerCase()
    return q.includes(f) || intent.includes(f) || keywords.includes(f)
  })

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  const renderStreamContent = (events: StreamEvent[]) => {
    return events.map((evt, i) => {
      if (evt.type === "tool_call") {
        const d = evt.data as { name?: string; input?: Record<string, unknown> }
        const name = d.name || "tool"
        const input = d.input || {}
        return (
          <div key={i} className="mb-1.5 text-xs font-mono text-teal-700 bg-teal-50/60 rounded px-2 py-1">
            <span className="font-semibold">{name}</span>
            <span className="text-teal-600/70 ml-1">{JSON.stringify(input).slice(0, 120)}</span>
          </div>
        )
      }
      if (evt.type === "agent_text") {
        const d = evt.data as { text?: string }
        const text = d.text || ""
        if (text.length < 5) return null
        return (
          <div key={i} className="mb-1.5 text-sm text-stone-600 italic border-l-2 border-stone-200 pl-2">
            {text.length > 200 ? text.slice(0, 200) + "..." : text}
          </div>
        )
      }
      if (evt.type === "error") {
        const d = evt.data as { message?: string }
        return (
          <div key={i} className="mb-1.5 text-xs text-red-600 bg-red-50 rounded px-2 py-1">Error: {d.message}</div>
        )
      }
      if (evt.type === "phase") {
        const d = evt.data as { phase?: string }
        return (
          <div key={i} className="mb-1.5 text-xs font-semibold text-stone-400 uppercase tracking-wider">— {d.phase} —</div>
        )
      }
      if (evt.type === "session_created") {
        const d = evt.data as { sessionId?: string }
        return <div key={i} className="mb-1.5 text-xs text-stone-400">Session: {d.sessionId?.slice(0, 8)}...</div>
      }
      return null
    })
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <h1 className="font-[family-name:var(--font-playfair)] text-xl font-semibold tracking-tight text-stone-900">Deep Researcher</h1>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-stone-500 font-medium uppercase tracking-wider">User</label>
            <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-md border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-400 w-40" placeholder="user-id" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <section className="mb-10">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-medium text-stone-900 mb-2 text-center">What would you like to research?</h2>
            <p className="text-stone-500 text-center mb-6 text-sm">Submit a topic and our AI agent will search the web, evaluate sources, and produce a summary.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-2">
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., Quantum computing breakthroughs 2026"
                  className="flex-1 text-base px-4 py-3 rounded-xl border border-stone-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent placeholder:text-stone-300"
                  disabled={isStreaming} />
                <select value={model} onChange={(e) => setModel(e.target.value)}
                  className="text-sm px-3 py-3 rounded-xl border border-stone-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  disabled={isStreaming}>
                  {availableModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  {availableModels.length === 0 && <option value="">default</option>}
                </select>
                <button type="submit" disabled={isStreaming || !query.trim()}
                  className="px-6 py-3 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {isStreaming ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>Researching
                    </span>
                  ) : "Research"}
                </button>
              </div>
            </form>
          </div>
        </section>

        {plan && (
          <section className="mb-6">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm p-5">
                <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                  Research Plan
                </h3>
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{plan}</p>
              </div>
            </div>
          </section>
        )}

        {(isStreaming || streamEvents.length > 0) && (
          <section className="mb-10">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                  <h3 className="text-sm font-semibold text-stone-700">Live Stream</h3>
                  {isStreaming && (
                    <span className="text-xs text-teal-600 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />Streaming
                    </span>
                  )}
                </div>
                <div className="px-4 py-3 max-h-80 overflow-y-auto">
                  {renderStreamContent(streamEvents)}
                  <div ref={streamEndRef} />
                </div>
              </div>
            </div>
          </section>
        )}

        {finalResult && (
          <section className="mb-10">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
                  <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-stone-900">Research Report</h3>
                </div>
                <div className="p-6">
                  <div className="prose prose-stone prose-sm max-w-none">
                    {/* Render markdown-like content with basic formatting */}
                    <div className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{finalResult.report}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-medium text-stone-900">Research History</h2>
            <div className="flex items-center gap-3">
              <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter history..."
                className="text-sm px-3 py-1.5 rounded-md border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 w-48" />
              <button onClick={handleTrendAnalysis} disabled={isTrending || history.length < 5}
                className="text-sm px-4 py-1.5 rounded-md border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {isTrending ? "Analyzing..." : "Trend Analysis"}
              </button>
            </div>
          </div>

          {pastTrends.length > 0 && (
            <div className="mb-4 flex gap-2 flex-wrap">
              {pastTrends.map((t) => (
                <span key={t.id} className="text-[10px] px-2 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                  {t.analysis_type} · {t.session_count} sessions · {formatDate(t.created_at)}
                </span>
              ))}
            </div>
          )}

          {isLoadingHistory ? (
            <div className="text-center py-12 text-stone-400 text-sm">Loading history...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              {searchFilter ? "No matches found." : "No research history yet. Submit your first query above."}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredHistory.map((item) => (
                <div key={item.session.id} onClick={() => setSelectedItem(item)}
                  className="group rounded-xl border border-stone-200 bg-white p-4 hover:shadow-md hover:border-stone-300 transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-stone-900 truncate mb-1">{item.session.query}</h3>
                      {item.session.intent && <p className="text-xs text-stone-500 mb-1.5 line-clamp-1">{item.session.intent}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        {(item.session.keywords || []).slice(0, 4).map((k) => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">{k}</span>
                        ))}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.session.status === "done" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
                          {item.session.status}
                        </span>
                        <span className="text-[10px] text-stone-400">{formatDate(item.session.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-stone-400">
                      {item.sources.length > 0 && <span className="text-xs">{item.sources.length} sources</span>}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-stone-900">{selectedItem.session.query}</h3>
                <p className="text-xs text-stone-400 mt-0.5">{formatDate(selectedItem.session.created_at)} · {selectedItem.session.model || "default"}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {selectedItem.session.intent && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Intent</h4>
                  <p className="text-sm text-stone-700">{selectedItem.session.intent}</p>
                </div>
              )}
              {selectedItem.summary && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Summary</h4>
                  <div className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap bg-stone-50 rounded-lg p-3">{selectedItem.summary.content}</div>
                </div>
              )}
              {selectedItem.translation && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                    Translation {selectedItem.translation.original_language && <span className="text-stone-400 normal-case">({selectedItem.translation.original_language})</span>}
                  </h4>
                  <div className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap bg-stone-50 rounded-lg p-3">{selectedItem.translation.translated}</div>
                </div>
              )}
              {selectedItem.sources.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Sources ({selectedItem.sources.length})</h4>
                  <div className="space-y-2">
                    {selectedItem.sources.map((s) => (
                      <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-stone-100 hover:border-stone-200 hover:bg-stone-50 transition-colors">
                        <div className="w-8 h-8 rounded bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-500 shrink-0">
                          {(s.domain_score * 100).toFixed(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">{s.title || s.url}</p>
                          <p className="text-xs text-stone-400 truncate">{s.domain}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trend Modal */}
      {isTrendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsTrendOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-stone-900">Trend Analysis</h3>
              <button onClick={() => setIsTrendOpen(false)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              {isTrending && trendEvents.length === 0 && (
                <div className="text-center py-8 text-stone-400 text-sm">Starting trend analysis...</div>
              )}
              {trendEvents.length > 0 && (
                <div className="mb-4 max-h-60 overflow-y-auto rounded-lg border border-stone-100 bg-stone-50/50 p-3">
                  {renderStreamContent(trendEvents)}
                </div>
              )}
              {trendResult && (
                <div className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap bg-stone-50 rounded-lg p-4">
                  {(() => {
                    try {
                      const parsed = JSON.parse(trendResult)
                      return JSON.stringify(parsed, null, 2)
                    } catch {
                      return trendResult
                    }
                  })()}
                </div>
              )}
              {!isTrending && !trendResult && trendEvents.length > 0 && (
                <div className="text-center py-4 text-stone-400 text-sm">Analysis complete. No structured result returned.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

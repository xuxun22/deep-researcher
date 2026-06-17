# Deep Researcher - 执行计划

## 项目概述

在 Vercel 上托管的 AI Agent，核心能力：搜索 → 权威性校验 → 摘要 → 中英翻译 → 历史存储 → 趋势分析。

支持一次性触发和定时调度两种运行模式。

---

## 技术栈

| 层面 | 选型 |
|------|------|
| 框架 | Next.js 15 (App Router) + TypeScript |
| AI SDK | `@anthropic-ai/claude-agent-sdk` 多模型支持 |
| 沙箱 | `@vercel/sandbox` |
| 搜索 | Tavily API |
| 数据库 | Supabase (PostgreSQL) |
| 响应 | 流式 SSE |
| 部署 | Vercel Serverless Functions + Cron |
| AI Skill 规范 | Copilot / Claude Code SKILL.md 规范 |

---

## 架构总览

```
                        ┌──────────────────────┐
                        │      Client          │
                        └──────────┬───────────┘
                                   │ SSE / REST
                        ┌──────────▼───────────┐
                        │   Vercel Functions    │
                        │   (Next.js API)       │
                        ├───────────────────────┤
    ┌───────────────────┤   Code Layer          ├───────────────────┐
    │                   │   - API Gateway       │                   │
    │                   │   - SSE Stream        │                   │
    │                   │   - Sandbox Manager   │                   │
    │                   │   - Scheduler (Cron)  │                   │
    │                   │   - Supabase Client   │                   │
    │                   │   - Skill Registry    │                   │
    │                   │   - Skill Runner      │                   │
    │                   │   - MCP Tools         │                   │
    │                   └───────────┬───────────┘                   │
    │                               │                               │
    │              ┌────────────────┼────────────────┐              │
    │              │                │                │              │
    │   ┌──────────▼──┐  ┌────────▼───────┐  ┌─────▼──────┐      │
    │   │ Vercel      │  │ Claude Agent   │  │ Supabase   │      │
    │   │ Sandbox     │  │ SDK            │  │            │      │
    │   │             │  │                │  │ - sessions │      │
    │   │ Agent执行环境│  │ Skills:        │  │ - sources  │      │
    │   │ 文件工作空间 │  │ - query-under  │  │ - summaries│      │
    │   └─────────────┘  │ - authority    │  │ - schedules│      │
    │                    │ - content-fetch│  │ - trends   │      │
    │                    │ - summarize    │  └────────────┘      │
    │                    │ - translate    │                       │
    │                    │ - trend-analyze│                       │
    │                    └────────────────┘                       │
    └─────────────────────────────────────────────────────────────┘
```

---

## 能力拆解：Code vs AI Skill

| 能力 | 实现方式 | 理由 | 可测试性 |
|------|---------|------|---------|
| API 路由分发 | Code | 确定性 HTTP 处理 | curl / HTTP 测试 |
| SSE 流管理 | Code | 协议层，确定性 | EventSource 客户端测试 |
| Supabase 读写 | Code | 数据库 CRUD | 直接查询数据库验证 |
| Cron 调度逻辑 | Code | 定时触发，确定性 | 手动触发 + 检查执行记录 |
| Sandbox 生命周期 | Code | 资源管理 | 创建/恢复/销毁验证 |
| Tavily HTTP 调用 | Code | 确定性 HTTP | 单元测试 mock |
| 域名规则评分 | Code | 查表，确定性 | 单元测试 |
| 结果过滤排序 | Code | 确定性排序 | 单元测试 |
| 历史数据聚合统计 | Code | SQL 聚合 + 计算 | 单元测试 |
| Skill Registry | Code | 发现+注册 | 单元测试 |
| Skill Runner | Code | SKILL.md → Agent | 集成测试 |
| 意图识别 & 关键词 | **AI Skill** | 需要语义理解 | 人工验证输出质量 |
| 权威性评估 | **AI Skill** | 需要内容质量判断 | 人工验证评分合理性 |
| 网页内容提取 | **AI Skill** | 需要正文识别 | 对比原文验证 |
| 多源综合摘要 | **AI Skill** | 需要交叉验证推理 | 人工验证准确性 |
| 中英翻译 | **AI Skill** | 需要语义翻译 | 人工验证翻译质量 |
| 趋势分析 | **AI Skill** | 需要模式识别+洞察 | 人工验证洞察合理性 |

---

## Supabase 数据库设计

```sql
-- 研究会话
CREATE TABLE research_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  query         TEXT NOT NULL,
  intent        TEXT,
  keywords      JSONB,
  trigger_type  TEXT NOT NULL DEFAULT 'manual',
  schedule_id   UUID REFERENCES research_schedules(id),
  status        TEXT NOT NULL DEFAULT 'pending',
  model         TEXT,
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- 搜索来源
CREATE TABLE sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  url            TEXT NOT NULL,
  title          TEXT,
  domain         TEXT,
  domain_score   REAL,
  ai_score       REAL,
  total_score    REAL,
  content_text   TEXT,
  language       TEXT,
  published_at   TEXT,
  is_used        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 摘要
CREATE TABLE summaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  language      TEXT DEFAULT 'zh',
  citations     JSONB,
  confidence    REAL,
  gaps          JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 翻译结果
CREATE TABLE translations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  translated    TEXT NOT NULL,
  glossary      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 定时调度配置
CREATE TABLE research_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  query         TEXT NOT NULL,
  cron_expr     TEXT NOT NULL,
  model         TEXT DEFAULT 'claude-sonnet-4-6',
  config        JSONB DEFAULT '{}',
  is_active     BOOLEAN DEFAULT true,
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 趋势分析结果
CREATE TABLE trend_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  analysis_type   TEXT NOT NULL,
  scope_query     TEXT,
  session_count   INTEGER,
  input_summary   JSONB,
  result          JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## API 路由表

| 路由 | 方法 | 功能 | 类型 |
|------|------|------|------|
| `/api/research` | POST | 发起一次性研究（SSE 流式） | 手动 |
| `/api/history` | GET | 查询研究历史（分页/过滤） | 查询 |
| `/api/history/[id]` | GET | 查询单次研究详情 | 查询 |
| `/api/trends` | POST | 触发趋势分析（SSE 流式） | 手动 |
| `/api/trends` | GET | 查询已有趋势报告 | 查询 |
| `/api/schedules` | POST | 创建定时研究任务 | 配置 |
| `/api/schedules` | GET | 列出所有定时任务 | 查询 |
| `/api/schedules/[id]` | PATCH | 更新/暂停定时任务 | 配置 |
| `/api/schedules/[id]` | DELETE | 删除定时任务 | 配置 |
| `/api/cron/research` | POST | Cron 入口：执行到期定时任务 | 定时 |
| `/api/cron/trends` | POST | Cron 入口：定时趋势分析 | 定时 |
| `/api/models` | GET | 列出可用模型 | 查询 |

---

## AI Skills（SKILL.md 规范）

### 目录结构

```
skills/
├── query-understand/
│   ├── SKILL.md
│   ├── reference/intent-patterns.md
│   └── scripts/parse-keywords.ts
├── authority-evaluate/
│   ├── SKILL.md
│   ├── reference/domain-categories.md
│   ├── reference/credibility-criteria.md
│   └── agents/domain-checker.md
├── content-fetch/
│   ├── SKILL.md
│   └── reference/extraction-rules.md
├── summarize/
│   ├── SKILL.md
│   ├── reference/summary-templates.md
│   └── agents/fact-checker.md
├── translate/
│   ├── SKILL.md
│   └── reference/glossary.md
├── trend-analyze/
│   ├── SKILL.md
│   ├── reference/analysis-dimensions.md
│   ├── reference/report-templates.md
│   ├── agents/pattern-finder.md
│   ├── agents/insight-writer.md
│   └── scripts/aggregate-history.ts
└── shared/
    ├── domain-rules.json
    └── output-schemas.md
```

### 各 Skill 概要

| Skill | 工具集 | 子Agent | 输出 |
|-------|--------|---------|------|
| query-understand | 无（纯推理） | 无 | `{ intent, keywords[], language, searchStrategy }` |
| authority-evaluate | tavily-search, domain-score | domain-checker | `{ scoredSources[] }` |
| content-fetch | WebFetch | 无 | `{ contents[] }` |
| summarize | Read | fact-checker | `{ summary, citations[], confidence, gaps }` |
| translate | 无（纯推理） | 无 | `{ translated, glossary[] }` |
| trend-analyze | Read, history-query | pattern-finder, insight-writer | `{ trends, insights[], summary, recommendations[] }` |

---

## 触发机制

```
一次性: POST /api/research → executeResearch() → SSE 流式返回 + 保存到 Supabase
定时:   Vercel Cron → POST /api/cron/research → 查询到期任务 → executeResearch() → 静默执行 + 保存
```

### vercel.json Cron 配置

```json
{
  "crons": [
    { "path": "/api/cron/research", "schedule": "0 * * * *" },
    { "path": "/api/cron/trends", "schedule": "0 9 * * 1" }
  ]
}
```

---

## 项目文件结构

```
src/
├── app/api/
│   ├── research/route.ts
│   ├── history/route.ts
│   ├── history/[id]/route.ts
│   ├── trends/route.ts
│   ├── schedules/route.ts
│   ├── schedules/[id]/route.ts
│   ├── cron/research/route.ts
│   ├── cron/trends/route.ts
│   └── models/route.ts
├── lib/
│   ├── gateway/router.ts
│   ├── stream/sse.ts
│   ├── sandbox/manager.ts
│   ├── db/
│   │   ├── supabase.ts
│   │   ├── schema.ts
│   │   └── queries/
│   │       ├── sessions.ts
│   │       ├── sources.ts
│   │       ├── schedules.ts
│   │       └── trends.ts
│   ├── search/tavily-client.ts
│   ├── authority/
│   │   ├── domain-rules.ts
│   │   └── ranker.ts
│   ├── scheduler/cron-handler.ts
│   └── config/env.ts
├── core/
│   ├── skill-registry.ts
│   ├── skill-runner.ts
│   ├── skill-types.ts
│   ├── history-context.ts
│   ├── mcp-tools/
│   │   ├── tavily-search-tool.ts
│   │   ├── domain-score-tool.ts
│   │   └── history-query-tool.ts
│   └── pipelines/
│       ├── research-pipeline.ts
│       ├── quick-search-pipeline.ts
│       └── trend-pipeline.ts
├── skills/ (见上方 AI Skills 目录结构)
supabase/migrations/001_init.sql
vercel.json
```

---

## 执行步骤

| # | 步骤 | 层 | 验证方式 |
|---|------|---|---------|
| 1 | 项目初始化 + 依赖安装 | - | `pnpm dev` 能启动 |
| 2 | Supabase schema + 客户端 | Code | 连接测试 + 类型生成 |
| 3 | Config + Tavily + Domain Rules | Code | 单元测试: 搜索调用 + 域名评分 |
| 4 | Sandbox Manager | Code | 集成测试: 创建/恢复/销毁 |
| 5 | Skill Types + Registry + Runner | Core | 单元测试: SKILL.md 解析 + 注册 |
| 6 | MCP Tools | Core | 单元测试: Tool 调用返回正确格式 |
| 7 | Skills: query-understand + authority-evaluate + content-fetch | Skill | 人工验证: 输出质量检查 |
| 8 | Skills: summarize + translate | Skill | 人工验证: 摘要准确性 + 翻译质量 |
| 9 | Pipeline + Research API + SSE + 历史保存 | Code | E2E: curl 调用 → SSE 流 → 数据库验证 |
| 10 | Schedule + Cron Handler | Code | 手动触发 Cron → 验证执行记录 |
| 11 | trend-analyze Skill + Trend API | Skill+Code | 人工验证: 趋势洞察合理性 |
| 12 | Vercel 部署 + 端到端测试 | - | 线上 curl 全流程验证 |

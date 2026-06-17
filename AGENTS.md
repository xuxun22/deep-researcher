# AGENTS.md

## Project Overview

Deep Researcher is a Vercel-hosted AI agent API service. It searches the web via Tavily, evaluates source authority, summarizes findings, translates English content to Chinese, persists research history to Supabase, and performs trend analysis on historical research.

The project has two distinct layers:
- **Code Layer** (`src/lib/`, `src/app/api/`): Deterministic infrastructure — HTTP clients, DB queries, SSE streaming, Cron scheduling, Sandbox management.
- **AI Skill Layer** (`src/skills/`): Each skill is a SKILL.md-compliant directory (compatible with GitHub Copilot and Claude Code). Skills define agent instructions, reference docs, and subagent definitions.
- **Core Engine** (`src/core/`): The bridge — Skill Registry discovers SKILL.md files, Skill Runner executes them via `@anthropic-ai/claude-agent-sdk` inside a `@vercel/sandbox` VM.

## Setup Commands

- Install deps: `pnpm install`
- Start dev server: `pnpm dev`
- Run typecheck: `pnpm typecheck`
- Run tests: `pnpm test`
- Run all checks before committing: `pnpm typecheck && pnpm test && pnpm lint`

## Environment Variables

Copy `.env.example` to `.env.local` and fill in real values:

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API access |
| `ANTHROPIC_AUTH_TOKEN` | Alternative auth token (e.g. Dashscope proxy) |
| `ANTHROPIC_BASE_URL` | Custom API endpoint (e.g. `https://coding.dashscope.aliyuncs.com/apps/anthropic`) |
| `ANTHROPIC_MODEL` | Override default model (e.g. `qwen3.7-plus`) |
| `TAVILY_API_KEY` | Web search API |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (for server-side writes) |
| `VERCEL_TEAM_ID` | Vercel team (for Sandbox SDK) |
| `VERCEL_PROJECT_ID` | Vercel project (for Sandbox SDK) |
| `VERCEL_TOKEN` | Vercel token (for Sandbox SDK outside Vercel) |
| `CRON_SECRET` | Auth token for Cron endpoints |
| `DEFAULT_MODEL` | Default AI model (default: `claude-sonnet-4-6`) |

## Architecture

```
src/
├── app/api/            # Next.js API routes
│   ├── research/       # POST: one-shot research (SSE stream)
│   ├── history/        # GET: query research history
│   ├── trends/         # GET: list trends, POST: trigger trend analysis (SSE)
│   ├── schedules/      # CRUD for scheduled research
│   ├── cron/           # Vercel Cron entry points
│   └── models/         # GET: available AI models
├── lib/                # Code Layer (deterministic)
│   ├── db/             # Supabase client + typed query modules
│   ├── search/         # Tavily HTTP client
│   ├── authority/      # Domain rules engine + ranker
│   ├── sandbox/        # Vercel Sandbox lifecycle
│   ├── stream/         # SSE stream helper
│   ├── scheduler/      # Cron logic
│   └── config/         # Env + model config
├── core/               # Skill runtime engine
│   ├── skill-registry  # Scans skills/, parses SKILL.md frontmatter
│   ├── skill-runner    # SKILL.md → Agent SDK execution
│   ├── skill-types     # Shared interfaces
│   └── mcp-tools/      # MCP tools exposed to skills
└── skills/             # AI Skill Layer (SKILL.md format)
    ├── query-understand/
    ├── authority-evaluate/
    ├── content-fetch/
    ├── summarize/
    ├── translate/
    ├── trend-analyze/
    └── shared/
```

## Coding Conventions

- TypeScript strict mode. No `any` unless absolutely necessary.
- Use `@/` path alias for imports from `src/`.
- Single quotes, no semicolons in non-TypeScript files.
- Functional patterns preferred over classes (except SkillRegistry).
- All DB query modules return typed results from `src/lib/db/types.ts`.
- Never hardcode API keys. Always read from `process.env` via `src/lib/config/env.ts`.

## SKILL.md Format

Every AI skill lives in `src/skills/<skill-name>/` and must follow this structure:

```
<skill-name>/
├── SKILL.md              # Required. YAML frontmatter (name, description) + markdown instructions.
├── reference/            # Optional. Docs loaded into agent workspace on execution.
├── scripts/              # Optional. Deterministic scripts the agent can run.
└── agents/               # Optional. Subagent definitions (one .md per subagent).
```

Key rules:
- `description` in frontmatter is the trigger mechanism. Write it to be inclusive — use "Use when..." phrasing.
- The SKILL.md body becomes the agent's system prompt. Keep it under 200 lines.
- Reference files are uploaded to the Sandbox workspace before execution.
- Agent `.md` files in `agents/` are registered as subagents automatically.

## MCP Tools

MCP tools are defined inline within the Sandbox runner script (`src/core/skill-runner.ts`) using `@anthropic-ai/claude-agent-sdk`'s `tool()` + `createSdkMcpServer()`. They execute inside the Sandbox VM, giving the agent access to external APIs without leaving the isolated environment.

Current tools exposed to skills:
- `tavily_search` / `tavily_extract` — Web search and content extraction via Tavily API.
- `domain_score` / `batch_domain_score` — Simple heuristic-based domain authority scoring.

When adding a new MCP tool:
1. Add the `tool()` definition to the `RUNNER_SCRIPT` template in `src/core/skill-runner.ts`.
2. Include the tool name in the `allowedTools` array.
3. Reference the tool name in the relevant SKILL.md.

## Testing Instructions

- Run all tests: `pnpm test`
- Run only lib tests: `pnpm test -- __tests__/lib`
- Run only core tests: `pnpm test -- __tests__/core`
- Watch mode: `pnpm test:watch`
- Test framework: Vitest. Config in `vitest.config.ts`.
- Tests use `@/` alias. Place test files in `__tests__/` mirroring the `src/` structure.
- Add tests for any Code Layer module you create or modify.
- AI Skills are verified via the skill-discovery test (`__tests__/core/skill-discovery.test.ts`).

## Verification Checklist

Before committing, ensure:
1. `pnpm typecheck` passes with zero errors.
2. `pnpm test` passes (all green).
3. `pnpm lint` passes.
4. New Code Layer modules have corresponding test files.
5. New Skills have valid SKILL.md frontmatter (name + description).
6. No secrets or API keys in source code or committed files.

## Database

- Schema: `supabase/migrations/001_init.sql`
- Tables: `research_sessions`, `sources`, `summaries`, `translations`, `research_schedules`, `trend_analyses`
- Types: `src/lib/db/types.ts` (manually maintained, matches schema)
- Queries: `src/lib/db/queries/` — one file per table, typed inputs/outputs

## API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/api/research` | POST | Start research (SSE). Body: `{ query, userId, model? }` |
| `/api/history` | GET | List sessions. Query: `userId, limit?, offset?, status?` |
| `/api/history/[id]` | GET | Session detail with sources, summary, translation |
| `/api/trends` | GET | List trend analyses. Query: `userId, limit?, offset?, type?` |
| `/api/trends` | POST | Trigger trend analysis (SSE). Body: `{ userId, days? }` |
| `/api/schedules` | GET | List schedules. Query: `userId` |
| `/api/schedules` | POST | Create schedule. Body: `{ userId, name, query, cronExpr, model? }` |
| `/api/schedules/[id]` | PATCH | Update schedule |
| `/api/schedules/[id]` | DELETE | Delete schedule |
| `/api/cron/research` | POST | Vercel Cron: execute due scheduled research |
| `/api/cron/trends` | POST | Vercel Cron: periodic trend analysis |
| `/api/models` | GET | List available AI models |

## Deployment

- Platform: Vercel (Pro plan required for 300s function timeout + Sandbox)
- Cron: configured in `vercel.json` — hourly research check, weekly trend analysis
- Build: `pnpm build` (do not run during dev — use `pnpm dev` instead)
- Deploy: `vercel --prod`

## PR Instructions

- Keep PRs focused on one capability at a time.
- Always run `pnpm typecheck && pnpm test && pnpm lint` before pushing.
- If you add a new API route, document it in this AGENTS.md under API Endpoints.
- If you add a new Skill, verify it's discovered by `pnpm test -- __tests__/core/skill-discovery.test.ts`.
- Never commit `.env.local` or files containing secrets.

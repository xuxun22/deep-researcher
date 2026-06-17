CREATE TABLE IF NOT EXISTS research_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  query         TEXT NOT NULL,
  intent        TEXT,
  keywords      JSONB,
  trigger_type  TEXT NOT NULL DEFAULT 'manual',
  schedule_id   UUID REFERENCES research_schedules(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  model         TEXT,
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sources (
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

CREATE TABLE IF NOT EXISTS summaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  language      TEXT DEFAULT 'zh',
  citations     JSONB,
  confidence    REAL,
  gaps          JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS translations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  translated    TEXT NOT NULL,
  glossary      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_schedules (
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

CREATE TABLE IF NOT EXISTS trend_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  analysis_type   TEXT NOT NULL DEFAULT 'comprehensive',
  scope_query     TEXT,
  session_count   INTEGER,
  input_summary   JSONB,
  result          JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON research_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_schedule ON research_sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON research_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sources_session ON sources(session_id);
CREATE INDEX IF NOT EXISTS idx_sources_domain ON sources(domain);
CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user ON research_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON research_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_trends_user ON trend_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trends_type ON trend_analyses(analysis_type);

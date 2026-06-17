export const config = {
  anthropic: {
    apiKey: () => {
      const key = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
      if (!key) throw new Error('ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN must be set');
      return key;
    },
    baseUrl: () => process.env.ANTHROPIC_BASE_URL,
    model: () => process.env.ANTHROPIC_MODEL,
  },
  tavily: {
    apiKey: () => {
      const key = process.env.TAVILY_API_KEY;
      if (!key) throw new Error('TAVILY_API_KEY is not set');
      return key;
    },
    baseUrl: 'https://api.tavily.com',
    maxResults: 10,
  },
  supabase: {
    url: () => {
      const url = process.env.SUPABASE_URL;
      if (!url) throw new Error('SUPABASE_URL is not set');
      return url;
    },
  },
  vercel: {
    teamId: () => process.env.VERCEL_TEAM_ID,
    projectId: () => process.env.VERCEL_PROJECT_ID,
    token: () => process.env.VERCEL_TOKEN,
  },
  cron: {
    secret: () => process.env.CRON_SECRET,
  },
  defaultModel: process.env.ANTHROPIC_MODEL ?? process.env.DEFAULT_MODEL ?? 'claude-sonnet-4-6',
  models: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
  ],
} as const;

export type ModelConfig = (typeof config.models)[number];

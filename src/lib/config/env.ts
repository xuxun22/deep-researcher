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
      const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set');
      return url;
    },
    serviceKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: () => {
      const key = process.env.SUPABASE_ANON_KEY
        ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!key) throw new Error('SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set');
      return key;
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
  defaultModel: process.env.ANTHROPIC_MODEL ?? process.env.DEFAULT_MODEL ?? 'qwen3.7-plus',
  models: [
    { id: 'qwen3.7-plus', name: 'Qwen3.7 Plus', provider: 'alibaba' },
    { id: 'qwen3.6-plus', name: 'Qwen3.6 Plus', provider: 'alibaba' },
    { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus', provider: 'alibaba' },
    { id: 'qwen3-max-2026-01-23', name: 'Qwen3 Max 0123', provider: 'alibaba' },
    { id: 'qwen3-coder-next', name: 'Qwen3 Coder Next', provider: 'alibaba' },
    { id: 'qwen3-coder-plus', name: 'Qwen3 Coder Plus', provider: 'alibaba' },
    { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', provider: 'minimax' },
    { id: 'glm-5', name: 'GLM-5', provider: 'zhipu' },
    { id: 'glm-4.7', name: 'GLM-4.7', provider: 'zhipu' },
    { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'moonshot' },
  ],
} as const;

export type ModelConfig = (typeof config.models)[number];

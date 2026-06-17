import { Sandbox } from '@vercel/sandbox';
import { config } from '@/lib/config/env';

let sandboxPromise: Promise<Sandbox> | null = null;

export async function getResearchSandbox(): Promise<Sandbox> {
  if (sandboxPromise) {
    return sandboxPromise;
  }

  sandboxPromise = Sandbox.getOrCreate({
    name: 'deep-researcher-agent',
    persistent: true,
    timeout: 300_000, // 5 minutes
    resources: { vcpus: 2 },
    env: {
      ANTHROPIC_API_KEY: config.anthropic.apiKey(),
      ...(config.anthropic.baseUrl()
        ? { ANTHROPIC_BASE_URL: config.anthropic.baseUrl() }
        : {}),
      ...(config.anthropic.model()
        ? { ANTHROPIC_MODEL: config.anthropic.model() }
        : {}),
      TAVILY_API_KEY: config.tavily.apiKey(),
      NODE_ENV: 'production',
      CLAUDE_AGENT_SDK_CLIENT_APP: 'deep-researcher/0.1.0',
    },
    onCreate: async (sbx) => {
      await sbx.runCommand('npm', ['init', '-y']);
      await sbx.runCommand('npm', [
        'install',
        '@anthropic-ai/claude-agent-sdk',
        'zod',
      ]);
    },
  });

  return sandboxPromise;
}

export async function resetSandbox(): Promise<void> {
  sandboxPromise = null;
}

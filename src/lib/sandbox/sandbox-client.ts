import { Sandbox } from '@vercel/sandbox'
import { config } from '@/lib/config/env'

async function ensureSandboxDeps(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.runCommand(
      'node',
      ['-e', "require('@anthropic-ai/claude-agent-sdk')"],
      { timeoutMs: 5000 }
    )
  } catch {
    await sandbox.runCommand('npm', ['init', '-y'], { timeoutMs: 30000 })
    await sandbox.runCommand(
      'npm',
      ['install', '@anthropic-ai/claude-agent-sdk', 'zod'],
      { timeoutMs: 120000 }
    )
  }
}

export async function getResearchSandbox(): Promise<Sandbox> {
  const sbx = await Sandbox.getOrCreate({
    name: 'deep-researcher-agent',
    persistent: true,
    timeout: 300_000,
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
      await sbx.runCommand('npm', ['init', '-y'])
      await sbx.runCommand('npm', [
        'install',
        '@anthropic-ai/claude-agent-sdk',
        'zod',
      ])
    },
  })

  await ensureSandboxDeps(sbx)
  return sbx
}

export async function resetSandbox(): Promise<void> {
  // no-op
}

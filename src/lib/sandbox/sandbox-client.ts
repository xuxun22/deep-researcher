import { Sandbox } from '@vercel/sandbox'
import { config } from '@/lib/config/env'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

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

async function installSkills(sandbox: Sandbox): Promise<void> {
  const skillsDir = join(process.cwd(), 'src', 'skills')
  const skillNames = await readdir(skillsDir)
  const files: Array<{ path: string; content: string }> = []

  for (const name of skillNames) {
    if (name === 'shared') continue
    const skillPath = join(skillsDir, name, 'SKILL.md')
    try {
      const content = await readFile(skillPath, 'utf-8')
      files.push({
        path: `/vercel/sandbox/.claude/skills/${name}/SKILL.md`,
        content,
      })
    } catch {
      // skip skills without SKILL.md
    }
  }

  if (files.length > 0) {
    await sandbox.writeFiles(files)
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
      await installSkills(sbx)
    },
  })

  await ensureSandboxDeps(sbx)
  return sbx
}

export async function resetSandbox(): Promise<void> {
  // no-op
}

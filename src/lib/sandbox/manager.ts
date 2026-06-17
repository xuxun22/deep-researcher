import { Sandbox } from '@vercel/sandbox';
import { config } from '@/lib/config/env';

export interface SandboxContext {
  sandbox: Sandbox;
  workspacePath: string;
}

let sharedSandbox: Sandbox | null = null;

export async function getOrCreateSandbox(name?: string): Promise<SandboxContext> {
  const sandboxName = name ?? 'deep-researcher';

  const sandbox = await Sandbox.getOrCreate({
    name: sandboxName,
    runtime: 'node24',
    resources: { vcpus: 2 },
    timeout: 30 * 60 * 1000,
    env: {
      ANTHROPIC_API_KEY: config.anthropic.apiKey(),
      TAVILY_API_KEY: config.tavily.apiKey(),
    },
    onCreate: async (sbx) => {
      await sbx.fs.mkdir('/vercel/sandbox/workspace', { recursive: true });
    },
  });

  return { sandbox, workspacePath: '/vercel/sandbox/workspace' };
}

export async function createEphemeralSandbox(): Promise<SandboxContext> {
  const uniqueName = `research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const sandbox = await Sandbox.create({
    name: uniqueName,
    runtime: 'node24',
    resources: { vcpus: 2 },
    timeout: 15 * 60 * 1000,
    persistent: false,
    env: {
      ANTHROPIC_API_KEY: config.anthropic.apiKey(),
      TAVILY_API_KEY: config.tavily.apiKey(),
    },
  });

  await sandbox.fs.mkdir('/vercel/sandbox/workspace', { recursive: true });

  return { sandbox, workspacePath: '/vercel/sandbox/workspace' };
}

export async function cleanupSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.stop();
  } catch {
    // ignore cleanup errors
  }
}

export async function writeToSandbox(
  ctx: SandboxContext,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  await ctx.sandbox.writeFiles(
    files.map(f => ({
      path: f.path.startsWith('/') ? f.path : `${ctx.workspacePath}/${f.path}`,
      content: Buffer.from(f.content, 'utf-8'),
    }))
  );
}

export async function readFromSandbox(
  ctx: SandboxContext,
  path: string
): Promise<string | null> {
  const fullPath = path.startsWith('/') ? path : `${ctx.workspacePath}/${path}`;
  const buffer = await ctx.sandbox.readFileToBuffer({ path: fullPath });
  return buffer ? buffer.toString('utf-8') : null;
}

export async function listSandboxFiles(
  ctx: SandboxContext,
  dir: string = ''
): Promise<string[]> {
  const fullPath = dir.startsWith('/') ? dir : `${ctx.workspacePath}/${dir}`;
  const entries = await ctx.sandbox.fs.readdir(fullPath);
  return entries;
}

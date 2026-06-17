import { query } from '@anthropic-ai/claude-agent-sdk';
import { readdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import type { SkillMeta, SkillContext, SkillEvent, SkillInput } from './skill-types';
import { writeToSandbox } from '@/lib/sandbox/manager';
import { createTavilyMcpServer } from './mcp-tools/tavily-search-tool';
import { createDomainScoreMcpServer } from './mcp-tools/domain-score-tool';
import { config } from '@/lib/config/env';

export interface RunSkillOptions {
  skill: SkillMeta;
  input: SkillInput;
  ctx: SkillContext;
  allowedTools?: string[];
  extraMcpServers?: Record<string, ReturnType<typeof createTavilyMcpServer>>;
}

export async function* runSkill(options: RunSkillOptions): AsyncIterable<SkillEvent> {
  const { skill, input, ctx, allowedTools, extraMcpServers } = options;

  yield { type: 'skill_start', data: { skill: skill.name } };

  await prepareSkillWorkspace(skill, input, ctx);

  const tavilyServer = createTavilyMcpServer(ctx.tavilyClient);
  const domainScoreServer = createDomainScoreMcpServer(ctx.domainRules);

  const mcpServers = {
    tavily: tavilyServer,
    domainScore: domainScoreServer,
    ...(extraMcpServers ?? {}),
  };

  const agents = await loadSubagents(skill.skillDir);

  const systemPrompt = buildSystemPrompt(skill, ctx);

  const agentQuery = query({
    prompt: JSON.stringify(input),
    options: {
      systemPrompt,
      cwd: ctx.sandbox.workspacePath,
      mcpServers,
      agents: Object.keys(agents).length > 0 ? agents : undefined,
      allowedTools: allowedTools ?? ['Read', 'WebFetch', 'Bash'],
      model: ctx.model,
      maxTurns: 10,
      env: {
        ANTHROPIC_API_KEY: config.anthropic.apiKey(),
        ...(config.anthropic.baseUrl() && {
          ANTHROPIC_BASE_URL: config.anthropic.baseUrl(),
        }),
      },
    },
  });

  let result: string | undefined;

  for await (const message of agentQuery) {
    if (ctx.signal.aborted) break;

    if ('result' in message) {
      result = message.result;
    } else {
      yield {
        type: 'agent_message',
        data: { ...(typeof message === 'object' ? message : {}) },
      };
    }
  }

  yield { type: 'skill_result', data: { skill: skill.name, result } };
  yield { type: 'skill_end', data: { skill: skill.name } };
}

function buildSystemPrompt(skill: SkillMeta, ctx: SkillContext): string {
  const parts = [skill.body];

  parts.push('\n\n---\n## Execution Context');
  parts.push(`- Working directory: ${ctx.sandbox.workspacePath}`);
  parts.push(`- Model: ${ctx.model}`);
  if (ctx.sessionId) parts.push(`- Session ID: ${ctx.sessionId}`);
  if (ctx.userId) parts.push(`- User ID: ${ctx.userId}`);

  parts.push('\n\n## Output Format');
  parts.push('Return your final answer as a valid JSON object. Do not wrap it in markdown code blocks.');

  return parts.join('\n');
}

async function prepareSkillWorkspace(
  skill: SkillMeta,
  input: SkillInput,
  ctx: SkillContext
): Promise<void> {
  const files: Array<{ path: string; content: string }> = [
    { path: 'input.json', content: JSON.stringify(input, null, 2) },
  ];

  const refDir = join(skill.skillDir, 'reference');
  try {
    await access(refDir);
    const refFiles = await readdir(refDir);
    for (const refFile of refFiles) {
      const content = await readFile(join(refDir, refFile), 'utf-8');
      files.push({ path: `reference/${refFile}`, content });
    }
  } catch {
    // no reference directory
  }

  await writeToSandbox(ctx.sandbox, files);
}

async function loadSubagents(
  skillDir: string
): Promise<Record<string, { description: string; prompt: string; tools: string[] }>> {
  const agentsDir = join(skillDir, 'agents');
  const agents: Record<string, { description: string; prompt: string; tools: string[] }> = {};

  try {
    await access(agentsDir);
  } catch {
    return agents;
  }

  const files = await readdir(agentsDir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const content = await readFile(join(agentsDir, file), 'utf-8');
    const agentName = file.replace('.md', '');
    const lines = content.split('\n');
    const description = lines.find(l => l.startsWith('description:'))?.replace('description:', '').trim()
      ?? `Subagent: ${agentName}`;

    agents[agentName] = {
      description,
      prompt: content,
      tools: ['Read', 'Grep', 'Glob'],
    };
  }

  return agents;
}

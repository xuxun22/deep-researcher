import type Anthropic from '@anthropic-ai/sdk';
import { readdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import type { SkillMeta, SkillContext, SkillEvent, SkillInput } from './skill-types';
import { getAnthropicClient } from '@/lib/ai/client';
import { createTools as createTavilyTools, executeTool as executeTavilyTool } from './tools/tavily-tools';
import { createTools as createDomainTools, executeTool as executeDomainTool } from './tools/domain-tools';

export interface RunSkillOptions {
  skill: SkillMeta;
  input: SkillInput;
  ctx: SkillContext;
  enabledTools?: ('tavily' | 'domain')[];
}

export async function* runSkill(options: RunSkillOptions): AsyncIterable<SkillEvent> {
  const { skill, input, ctx, enabledTools } = options;

  yield { type: 'skill_start', data: { skill: skill.name } };

  const tools = buildTools(ctx, enabledTools ?? ['tavily', 'domain']);
  const systemPrompt = buildSystemPrompt(skill, ctx);

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: JSON.stringify(input) },
  ];

  const client = getAnthropicClient();
  const maxTurns = 10;
  let result = '';

  for (let turn = 0; turn < maxTurns; turn++) {
    if (ctx.signal.aborted) break;

    yield { type: 'agent_turn', data: { turn: turn + 1 } };

    const response = await client.messages.create({
      model: ctx.model,
      max_tokens: 8192,
      system: systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      messages,
    });

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    );
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    if (textBlocks.length > 0) {
      result = textBlocks.map(b => b.text).join('\n');
      yield { type: 'agent_text', data: { text: result } };
    }

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      yield { type: 'tool_call', data: { name: toolUse.name, input: toolUse.input } };

      const toolOutput = await executeToolCall(toolUse.name, toolUse.input as Record<string, unknown>, ctx);

      yield { type: 'tool_result', data: { name: toolUse.name, outputLength: toolOutput.length } };

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: toolOutput,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  yield { type: 'skill_result', data: { skill: skill.name, result } };
  yield { type: 'skill_end', data: { skill: skill.name } };
}

async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  ctx: SkillContext
): Promise<string> {
  if (name === 'tavily_search' || name === 'tavily_extract') {
    return executeTavilyTool(name, input, ctx.tavilyClient);
  }
  if (name === 'domain_score' || name === 'batch_domain_score') {
    return executeDomainTool(name, input);
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

function buildTools(ctx: SkillContext, enabled: string[]): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [];
  if (enabled.includes('tavily')) {
    tools.push(...createTavilyTools(ctx.tavilyClient));
  }
  if (enabled.includes('domain')) {
    tools.push(...createDomainTools());
  }
  return tools;
}

function buildSystemPrompt(skill: SkillMeta, ctx: SkillContext): string {
  const parts = [skill.body];

  parts.push('\n\n---\n## Execution Context');
  parts.push(`- Model: ${ctx.model}`);
  if (ctx.sessionId) parts.push(`- Session ID: ${ctx.sessionId}`);
  if (ctx.userId) parts.push(`- User ID: ${ctx.userId}`);

  parts.push('\n\n## Output Format');
  parts.push('Return your final answer as a valid JSON object. Do not wrap it in markdown code blocks.');

  return parts.join('\n');
}

import type { SkillMeta, SkillContext, SkillEvent, SkillInput } from './skill-types'
import { getResearchSandbox } from '@/lib/sandbox/sandbox-client'

export interface RunSkillOptions {
  skill: SkillMeta
  input: SkillInput
  ctx: SkillContext
  enabledTools?: ('tavily' | 'domain')[]
}

const RUNNER_SCRIPT = `const { query, createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');
const { z } = require('zod');

async function main() {
  const config = JSON.parse(process.env.SKILL_CONFIG || '{}');
  const { systemPrompt, userInput, model, maxTurns, tools: toolConfigs } = config;

  const mcpServers = {};
  const allowedTools = [];

  if (toolConfigs.tavily) {
    mcpServers.tavily = createSdkMcpServer({
      name: 'tavily',
      tools: [
        tool('tavily_search', 'Search the web using Tavily API', {
          query: z.string().describe('Search query'),
          max_results: z.number().optional().describe('Maximum number of results'),
        }, async (args) => {
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + process.env.TAVILY_API_KEY,
            },
            body: JSON.stringify(args),
          });
          const data = await res.json();
          return { content: [{ type: 'text', text: JSON.stringify(data) }] };
        }),
        tool('tavily_extract', 'Extract content from URLs using Tavily API', {
          urls: z.array(z.string()).describe('List of URLs to extract'),
        }, async (args) => {
          const res = await fetch('https://api.tavily.com/extract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + process.env.TAVILY_API_KEY,
            },
            body: JSON.stringify(args),
          });
          const data = await res.json();
          return { content: [{ type: 'text', text: JSON.stringify(data) }] };
        }),
      ],
    });
    allowedTools.push('mcp__tavily__tavily_search', 'mcp__tavily__tavily_extract');
  }

  if (toolConfigs.domain) {
    mcpServers.domain = createSdkMcpServer({
      name: 'domain',
      tools: [
        tool('domain_score', 'Evaluate domain authority score (0-1)', {
          domain: z.string().describe('Domain name to score'),
        }, async (args) => {
          const { domain } = args;
          let score = 0.5;
          if (domain.endsWith('.edu') || domain.endsWith('.gov')) score = 0.95;
          else if (domain.endsWith('.org')) score = 0.75;
          else if (['wikipedia.org','arxiv.org','nature.com','ieee.org','acm.org','sciencedirect.com','springer.com','mit.edu','stanford.edu'].some(d => domain.includes(d))) score = 0.9;
          else if (['github.com','medium.com','reddit.com','twitter.com','x.com'].some(d => domain.includes(d))) score = 0.4;
          return { content: [{ type: 'text', text: JSON.stringify({ domain, score }) }] };
        }),
        tool('batch_domain_score', 'Score multiple domains at once', {
          domains: z.array(z.string()).describe('List of domain names'),
        }, async (args) => {
          const results = args.domains.map(domain => {
            let score = 0.5;
            if (domain.endsWith('.edu') || domain.endsWith('.gov')) score = 0.95;
            else if (domain.endsWith('.org')) score = 0.75;
            else if (['wikipedia.org','arxiv.org','nature.com','ieee.org','acm.org','sciencedirect.com','springer.com','mit.edu','stanford.edu'].some(d => domain.includes(d))) score = 0.9;
            else if (['github.com','medium.com','reddit.com','twitter.com','x.com'].some(d => domain.includes(d))) score = 0.4;
            return { domain, score };
          });
          return { content: [{ type: 'text', text: JSON.stringify({ results }) }] };
        }),
      ],
    });
    allowedTools.push('mcp__domain__domain_score', 'mcp__domain__batch_domain_score');
  }

  const q = query({
    prompt: userInput,
    options: {
      model: model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      agent: 'main',
      agents: {
        main: {
          description: 'Main research skill agent',
          prompt: systemPrompt,
        },
      },
      mcpServers,
      maxTurns: maxTurns || 10,
      persistSession: false,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
    },
  });

  for await (const msg of q) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(JSON.stringify({ type: 'result', result: msg.result }));
    } else if (msg.type === 'tool_use_summary') {
      console.log(JSON.stringify({ type: 'tool_use_summary', summary: msg.summary }));
    } else if (msg.type === 'assistant') {
      const text = msg.message?.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
      const toolUses = msg.message?.content?.filter(b => b.type === 'tool_use') || [];
      if (text) {
        console.log(JSON.stringify({ type: 'assistant_text', text }));
      }
      for (const tu of toolUses) {
        console.log(JSON.stringify({ type: 'tool_call', name: tu.name, input: tu.input }));
      }
    } else if (msg.type === 'error') {
      console.log(JSON.stringify({ type: 'error', message: msg.message || String(msg) }));
    }
  }
}

main().catch(err => {
  console.error(JSON.stringify({ type: 'fatal_error', message: err.message }));
  process.exit(1);
});
`

export async function* runSkill(options: RunSkillOptions): AsyncIterable<SkillEvent> {
  const { skill, input, ctx, enabledTools } = options

  yield { type: 'skill_start', data: { skill: skill.name } }

  const sandbox = await getResearchSandbox()

  const toolConfigs: Record<string, boolean> = {}
  if (enabledTools?.includes('tavily')) toolConfigs.tavily = true
  if (enabledTools?.includes('domain')) toolConfigs.domain = true

  const configPayload = {
    systemPrompt: buildSystemPrompt(skill, ctx),
    userInput: JSON.stringify(input),
    model: ctx.model,
    maxTurns: 10,
    tools: toolConfigs,
  }

  const scriptName = `skill-runner-${ctx.sessionId ?? Date.now()}.js`
  const scriptPath = `/vercel/sandbox/${scriptName}`

  await sandbox.writeFiles([
    { path: scriptPath, content: RUNNER_SCRIPT },
  ])

  yield { type: 'agent_turn', data: { turn: 1 } }

  const cmd = await sandbox.runCommand({
    cmd: 'node',
    args: [scriptName],
    cwd: '/vercel/sandbox',
    detached: true,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined)
      ) as Record<string, string>,
      SKILL_CONFIG: JSON.stringify(configPayload),
    },
  })

  let result = ''
  let errorMessage = ''

  for await (const log of cmd.logs()) {
    if (ctx.signal.aborted) {
      await cmd.kill('SIGTERM')
      break
    }

    const lines = log.data.split('\n').filter(l => l.trim())
    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        if (event.type === 'result') {
          result = event.result
          yield { type: 'agent_text', data: { text: result } }
        } else if (event.type === 'tool_use_summary') {
          yield { type: 'tool_call', data: { name: 'summary', input: { summary: event.summary } } }
        } else if (event.type === 'assistant_text') {
          yield { type: 'agent_text', data: { text: event.text } }
        } else if (event.type === 'error' || event.type === 'fatal_error') {
          errorMessage = event.message
          yield { type: 'error', data: { message: event.message } }
        }
      } catch {
        // Non-JSON line, ignore or log as debug
      }
    }
  }

  const finished = await cmd.wait()

  if (finished.exitCode !== 0 && !result) {
    const stderr = await finished.stderr()
    throw new Error(errorMessage || stderr || `Sandbox command exited with code ${finished.exitCode}`)
  }

  yield { type: 'skill_result', data: { skill: skill.name, result } }
  yield { type: 'skill_end', data: { skill: skill.name } }
}

function buildSystemPrompt(skill: SkillMeta, ctx: SkillContext): string {
  const parts = [skill.body]

  parts.push('\n\n---\n## Execution Context')
  parts.push(`- Model: ${ctx.model}`)
  if (ctx.sessionId) parts.push(`- Session ID: ${ctx.sessionId}`)
  if (ctx.userId) parts.push(`- User ID: ${ctx.userId}`)

  parts.push('\n\n## Output Format')
  parts.push('Return your final answer as a valid JSON object. Do not wrap it in markdown code blocks.')

  return parts.join('\n')
}

import type Anthropic from '@anthropic-ai/sdk';
import { getDomainCategory } from '@/lib/authority/domain-rules';

export function createTools(): Anthropic.Tool[] {
  return [
    {
      name: 'domain_score',
      description: 'Get the authority score for a domain based on predefined rules. Returns the domain category, base score, and label.',
      input_schema: {
        type: 'object' as const,
        properties: {
          domain: { type: 'string', description: 'The domain to evaluate (e.g., "stanford.edu", "nature.com")' },
        },
        required: ['domain'],
      },
    },
    {
      name: 'batch_domain_score',
      description: 'Get authority scores for multiple domains at once.',
      input_schema: {
        type: 'object' as const,
        properties: {
          domains: { type: 'array', items: { type: 'string' }, description: 'List of domains to evaluate' },
        },
        required: ['domains'],
      },
    },
  ];
}

export function executeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'domain_score': {
      const result = getDomainCategory(input.domain as string);
      return JSON.stringify({ domain: input.domain, category: result.category, baseScore: result.baseScore, label: result.label }, null, 2);
    }
    case 'batch_domain_score': {
      const results = (input.domains as string[]).map(domain => {
        const result = getDomainCategory(domain);
        return { domain, category: result.category, baseScore: result.baseScore, label: result.label };
      });
      return JSON.stringify(results, null, 2);
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

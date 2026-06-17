import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getDomainCategory } from '@/lib/authority/domain-rules';
import type { DomainRule } from '@/lib/authority/domain-rules';

export function createDomainScoreMcpServer(_domainRules: DomainRule[]) {
  const domainScoreTool = tool(
    'domain_score',
    'Get the authority score for a domain based on predefined rules. Returns the domain category, base score, and label.',
    {
      domain: z.string().describe('The domain to evaluate (e.g., "stanford.edu", "nature.com")'),
    },
    async (args) => {
      const result = getDomainCategory(args.domain);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              domain: args.domain,
              category: result.category,
              baseScore: result.baseScore,
              label: result.label,
            }, null, 2),
          },
        ],
      };
    }
  );

  const batchDomainScoreTool = tool(
    'batch_domain_score',
    'Get authority scores for multiple domains at once.',
    {
      domains: z.array(z.string()).describe('List of domains to evaluate'),
    },
    async (args) => {
      const results = args.domains.map(domain => {
        const result = getDomainCategory(domain);
        return {
          domain,
          category: result.category,
          baseScore: result.baseScore,
          label: result.label,
        };
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
  );

  return createSdkMcpServer({
    name: 'domain-score',
    tools: [domainScoreTool, batchDomainScoreTool],
  });
}

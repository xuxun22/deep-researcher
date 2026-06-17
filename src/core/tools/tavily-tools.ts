import type Anthropic from '@anthropic-ai/sdk';
import type { TavilyClient } from '@/lib/search/tavily-client';

export function createTools(tavilyClient: TavilyClient): Anthropic.Tool[] {
  return [
    {
      name: 'tavily_search',
      description: 'Search the web using Tavily API. Returns structured search results with titles, URLs, and content snippets.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'The search query' },
          max_results: { type: 'number', description: 'Maximum number of results (default: 10)' },
          search_depth: { type: 'string', enum: ['basic', 'advanced'], description: 'Search depth (default: basic)' },
          topic: { type: 'string', enum: ['general', 'news', 'finance'], description: 'Search topic (default: general)' },
          include_domains: { type: 'array', items: { type: 'string' }, description: 'Only include results from these domains' },
          exclude_domains: { type: 'array', items: { type: 'string' }, description: 'Exclude results from these domains' },
        },
        required: ['query'],
      },
    },
    {
      name: 'tavily_extract',
      description: 'Extract the main content from one or more URLs using Tavily API.',
      input_schema: {
        type: 'object' as const,
        properties: {
          urls: { type: 'array', items: { type: 'string' }, description: 'URLs to extract content from' },
        },
        required: ['urls'],
      },
    },
  ];
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  tavilyClient: TavilyClient
): Promise<string> {
  try {
    switch (name) {
      case 'tavily_search': {
        const response = await tavilyClient.search({
          query: input.query as string,
          maxResults: input.max_results as number | undefined,
          searchDepth: input.search_depth as 'basic' | 'advanced' | undefined,
          topic: input.topic as 'general' | 'news' | 'finance' | undefined,
          includeDomains: input.include_domains as string[] | undefined,
          excludeDomains: input.exclude_domains as string[] | undefined,
        });
        const results = response.results.map(r => ({
          title: r.title, url: r.url, content: r.content,
          score: r.score, published_date: r.published_date ?? null,
        }));
        return JSON.stringify({ query: response.query, answer: response.answer, results, response_time: response.response_time }, null, 2);
      }
      case 'tavily_extract': {
        const response = await tavilyClient.extract(input.urls as string[]);
        return JSON.stringify(response.results, null, 2);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ error: message });
  }
}

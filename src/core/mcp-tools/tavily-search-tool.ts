import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { TavilyClient } from '@/lib/search/tavily-client';

export function createTavilyMcpServer(tavilyClient: TavilyClient) {
  const tavilySearchTool = tool(
    'tavily_search',
    'Search the web using Tavily API. Returns structured search results with titles, URLs, and content snippets.',
    {
      query: z.string().describe('The search query'),
      max_results: z.number().optional().describe('Maximum number of results (default: 10)'),
      search_depth: z.enum(['basic', 'advanced']).optional().describe('Search depth (default: basic)'),
      topic: z.enum(['general', 'news', 'finance']).optional().describe('Search topic (default: general)'),
      include_domains: z.array(z.string()).optional().describe('Only include results from these domains'),
      exclude_domains: z.array(z.string()).optional().describe('Exclude results from these domains'),
    },
    async (args) => {
      try {
        const response = await tavilyClient.search({
          query: args.query,
          maxResults: args.max_results,
          searchDepth: args.search_depth,
          topic: args.topic,
          includeDomains: args.include_domains,
          excludeDomains: args.exclude_domains,
        });

        const results = response.results.map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          published_date: r.published_date ?? null,
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                query: response.query,
                answer: response.answer,
                results,
                response_time: response.response_time,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Search error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  const tavilyExtractTool = tool(
    'tavily_extract',
    'Extract the main content from one or more URLs using Tavily API.',
    {
      urls: z.array(z.string()).describe('URLs to extract content from'),
    },
    async (args) => {
      try {
        const response = await tavilyClient.extract(args.urls);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(response.results, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Extract error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return createSdkMcpServer({
    name: 'tavily',
    tools: [tavilySearchTool, tavilyExtractTool],
  });
}

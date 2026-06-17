import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/db/supabase';

export function createHistoryQueryMcpServer(userId: string) {
  const queryHistoryTool = tool(
    'query_history',
    'Query research history from the database. Returns past research sessions with their queries and results.',
    {
      days: z.number().optional().describe('Number of days to look back (default: 30)'),
      limit: z.number().optional().describe('Maximum number of sessions to return (default: 20)'),
      status: z.string().optional().describe('Filter by status (done, failed, etc.)'),
    },
    async (args) => {
      try {
        const supabase = getSupabaseClient();
        const days = args.days ?? 30;
        const limit = args.limit ?? 20;

        const since = new Date();
        since.setDate(since.getDate() - days);

        let query = supabase
          .from('research_sessions')
          .select('id, query, intent, keywords, status, created_at, completed_at')
          .eq('user_id', userId)
          .eq('status', args.status ?? 'done')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(data ?? [], null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Query error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return createSdkMcpServer({
    name: 'history-query',
    tools: [queryHistoryTool],
  });
}

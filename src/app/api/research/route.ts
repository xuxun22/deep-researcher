import { NextRequest } from 'next/server';
import { createSSEStream } from '@/lib/stream/sse';
import { executeResearch } from '@/core/pipelines/research-pipeline';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query, userId, model, scheduleId } = body;

  if (!query || !userId) {
    return Response.json(
      { error: 'query and userId are required' },
      { status: 400 }
    );
  }

  const { stream, send, close, error } = createSSEStream();

  (async () => {
    try {
      for await (const event of executeResearch({
        userId,
        query,
        model,
        scheduleId,
        triggerType: 'manual',
      })) {
        send(event);
      }
      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(message);
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

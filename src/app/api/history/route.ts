import { NextRequest } from 'next/server';
import { listSessions } from '@/lib/db/queries/sessions';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const offset = parseInt(searchParams.get('offset') ?? '0');
  const status = searchParams.get('status') as 'done' | 'failed' | 'pending' | null;

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const result = await listSessions({
      user_id: userId,
      limit,
      offset,
      status: status ?? undefined,
    });

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err)
        : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

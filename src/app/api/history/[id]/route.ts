import { NextRequest } from 'next/server';
import { getSession } from '@/lib/db/queries/sessions';
import { getSourcesBySession } from '@/lib/db/queries/sources';
import { getSummaryBySession } from '@/lib/db/queries/summaries';
import { getTranslationBySession } from '@/lib/db/queries/translations';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);

  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const [sources, summary, translation] = await Promise.all([
    getSourcesBySession(id),
    getSummaryBySession(id),
    getTranslationBySession(id),
  ]);

  return Response.json({ session, sources, summary, translation });
}

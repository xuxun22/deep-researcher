import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule, deleteSchedule } from '@/lib/db/queries/schedules';
import { CronExpressionParser } from 'cron-parser';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const schedule = await getSchedule(id);
  if (!schedule) {
    return Response.json({ error: 'Schedule not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.query !== undefined) updates.query = body.query;
  if (body.isActive !== undefined) updates.is_active = body.isActive;

  if (body.cronExpr !== undefined) {
    try {
      CronExpressionParser.parse(body.cronExpr);
    } catch {
      return Response.json({ error: 'Invalid cron expression' }, { status: 400 });
    }
    updates.cron_expr = body.cronExpr;
  }

  if (body.model !== undefined) updates.model = body.model;

  await updateSchedule(id, updates);
  return Response.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const schedule = await getSchedule(id);

  if (!schedule) {
    return Response.json({ error: 'Schedule not found' }, { status: 404 });
  }

  await deleteSchedule(id);
  return Response.json({ success: true });
}

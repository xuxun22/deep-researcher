import { NextRequest } from 'next/server';
import { listSchedules, createSchedule } from '@/lib/db/queries/schedules';
import { CronExpressionParser } from 'cron-parser';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const schedules = await listSchedules(userId);
  return Response.json({ schedules });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, name, query, cronExpr, model } = body;

  if (!userId || !name || !query || !cronExpr) {
    return Response.json(
      { error: 'userId, name, query, and cronExpr are required' },
      { status: 400 }
    );
  }

  try {
    CronExpressionParser.parse(cronExpr);
  } catch {
    return Response.json({ error: 'Invalid cron expression' }, { status: 400 });
  }

  const interval = CronExpressionParser.parse(cronExpr);
  const nextRunAt = interval.next().toDate().toISOString();

  const schedule = await createSchedule({
    user_id: userId,
    name,
    query,
    cron_expr: cronExpr,
    model,
  });

  return Response.json({ schedule, nextRunAt }, { status: 201 });
}

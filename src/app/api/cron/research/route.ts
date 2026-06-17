import { NextRequest } from 'next/server';
import { getDueSchedules, updateSchedule } from '@/lib/db/queries/schedules';
import { executeResearch } from '@/core/pipelines/research-pipeline';
import { CronExpressionParser } from 'cron-parser';
import { config } from '@/lib/config/env';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = config.cron.secret();

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dueSchedules = await getDueSchedules();
  const results: Array<{ scheduleId: string; status: string; error?: string }> = [];

  for (const schedule of dueSchedules) {
    try {
      const events: unknown[] = [];
      for await (const event of executeResearch({
        userId: schedule.user_id,
        query: schedule.query,
        model: schedule.model,
        scheduleId: schedule.id,
        triggerType: 'scheduled',
      })) {
        events.push(event);
      }

      const interval = CronExpressionParser.parse(schedule.cron_expr);
      const nextRunAt = interval.next().toDate().toISOString();

      await updateSchedule(schedule.id, {
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt,
      });

      results.push({ scheduleId: schedule.id, status: 'completed' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ scheduleId: schedule.id, status: 'failed', error: message });
    }
  }

  return Response.json({
    processed: dueSchedules.length,
    results,
  });
}

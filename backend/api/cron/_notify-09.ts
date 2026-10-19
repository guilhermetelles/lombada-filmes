import { runDailyNotify } from '../../lib/daily/run-daily-notify.js';
import { cronRoute } from '../../lib/http/cron-route.js';
import { runJob } from '../../lib/jobs/job-health.js';
import { describeNotify } from '../../lib/jobs/job-outcomes.js';
import { logger } from '../../lib/logging/logger.js';

/**
 * GET /api/cron/notify-09: notificação diária de quem escolheu 9h de Brasília (12:00 UTC).
 *
 * Grava a saúde da execução em jobs/notify-09. Responde 200 com o relatório, ou 401 sem o segredo do cron.
 */
export const notify09CronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runJob(
    { dependencies, usage },
    'notify-09',
    () => runDailyNotify(dependencies, usage, 9),
    describeNotify,
  );
  logger.info('notificação diária concluída', { report });
  return Response.json(report);
});

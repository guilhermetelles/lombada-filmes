import { runDailyNotify } from '../../lib/daily/run-daily-notify.js';
import { cronRoute } from '../../lib/http/cron-route.js';
import { runJob } from '../../lib/jobs/job-health.js';
import { describeNotify } from '../../lib/jobs/job-outcomes.js';
import { logger } from '../../lib/logging/logger.js';

/**
 * GET /api/cron/notify-12: notificação diária de quem escolheu 12h de Brasília (15:00 UTC).
 *
 * Grava a saúde da execução em jobs/notify-12. Responde 200 com o relatório, ou 401 sem o segredo do cron.
 */
export const notify12CronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runJob(
    { dependencies, usage },
    'notify-12',
    () => runDailyNotify(dependencies, usage, 12),
    describeNotify,
  );
  logger.info('notificação diária concluída', { report });
  return Response.json(report);
});

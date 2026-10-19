import { runDailyNotify } from '../../lib/daily/run-daily-notify.js';
import { cronRoute } from '../../lib/http/cron-route.js';
import { runJob } from '../../lib/jobs/job-health.js';
import { describeNotify } from '../../lib/jobs/job-outcomes.js';
import { logger } from '../../lib/logging/logger.js';

/**
 * GET /api/cron/notify-21: notificação diária de quem escolheu 21h de Brasília (00:00 UTC, que em
 * Brasília ainda é o dia anterior: a data do notifyLog e do conteúdo é a de Brasília).
 *
 * Grava a saúde da execução em jobs/notify-21. Responde 200 com o relatório, ou 401 sem o segredo do cron.
 */
export const notify21CronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runJob(
    { dependencies, usage },
    'notify-21',
    () => runDailyNotify(dependencies, usage, 21),
    describeNotify,
  );
  logger.info('notificação diária concluída', { report });
  return Response.json(report);
});

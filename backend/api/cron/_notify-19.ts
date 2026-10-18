import { runDailyNotify } from '../../lib/daily/run-daily-notify.js';
import { cronRoute } from '../../lib/http/cron-route.js';
import { logger } from '../../lib/logging/logger.js';

/**
 * GET /api/cron/notify-19: notificação diária de quem escolheu 19h de Brasília (22:00 UTC).
 *
 * Responde 200 com o relatório, ou 401 sem o segredo do cron.
 */
export const notify19CronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runDailyNotify(dependencies, usage, 19);
  logger.info('notificação diária concluída', { report });
  return Response.json(report);
});

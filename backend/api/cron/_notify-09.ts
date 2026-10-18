import { runDailyNotify } from '../../lib/daily/run-daily-notify.js';
import { cronRoute } from '../../lib/http/cron-route.js';
import { logger } from '../../lib/logging/logger.js';

/**
 * GET /api/cron/notify-09: notificação diária de quem escolheu 9h de Brasília (12:00 UTC).
 *
 * Responde 200 com o relatório, ou 401 sem o segredo do cron.
 */
export const notify09CronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runDailyNotify(dependencies, usage, 9);
  logger.info('notificação diária concluída', { report });
  return Response.json(report);
});

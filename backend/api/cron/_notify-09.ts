import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { cronRoute } from '../../lib/http/cron-route.js';

/**
 * GET /api/cron/notify-09: notificação diária de quem escolheu 9h de Brasília (12:00 UTC).
 *
 * Responde 200 com o relatório, ou 401 sem o segredo do cron. Esqueleto: responde 501.
 */
export const notify09CronRoute = cronRoute(async () => {
  throw new NotImplementedError('notificação das 9h não implementado');
});

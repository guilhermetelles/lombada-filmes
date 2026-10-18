import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { cronRoute } from '../../lib/http/cron-route.js';

/**
 * GET /api/cron/notify-19: notificação diária de quem escolheu 19h de Brasília (22:00 UTC).
 *
 * Responde 200 com o relatório, ou 401 sem o segredo do cron. Esqueleto: responde 501.
 */
export const notify19CronRoute = cronRoute(async () => {
  throw new NotImplementedError('notificação das 19h não implementado');
});

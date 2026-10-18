import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { cronRoute } from '../../lib/http/cron-route.js';

/**
 * GET /api/cron/notify-21: notificação diária de quem escolheu 21h de Brasília (00:00 UTC, que em
 * Brasília ainda é o dia anterior).
 *
 * Responde 200 com o relatório, ou 401 sem o segredo do cron. Esqueleto: responde 501.
 */
export const notify21CronRoute = cronRoute(async () => {
  throw new NotImplementedError('notificação das 21h não implementado');
});

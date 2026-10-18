import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { cronRoute } from '../../lib/http/cron-route.js';

/**
 * GET /api/cron/recs: rotina das 05h de Brasília (vercel.json). Calcula recs/current de cada lista.
 *
 * Responde 200 com o relatório, ou 401 sem o segredo do cron. Esqueleto: responde 501.
 */
export const recsCronRoute = cronRoute(async () => {
  throw new NotImplementedError('rotina recs não implementado');
});

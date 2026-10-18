import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';

/**
 * POST /api/me/notify-test: manda uma notificação de teste para os aparelhos de quem chamou.
 *
 * Responde 200 `{ sent }`, ou 401 sem token válido. Esqueleto: responde 501.
 */
export const notifyTestRoute = authenticatedRoute(async () => {
  throw new NotImplementedError('notificação de teste não implementado');
});

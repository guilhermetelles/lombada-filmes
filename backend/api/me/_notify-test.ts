import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { sendTestPush } from '../../lib/notify/devices.js';

/**
 * POST /api/me/notify-test: manda uma notificação de teste para os aparelhos de quem chamou.
 *
 * Responde 200 `{ sent }` (quantos aparelhos o FCM aceitou; 0 sem aparelho registrado), ou 401 sem
 * token válido.
 */
export const notifyTestRoute = authenticatedRoute(async ({ uid, dependencies }) =>
  Response.json({ sent: await sendTestPush(dependencies, uid) }),
);

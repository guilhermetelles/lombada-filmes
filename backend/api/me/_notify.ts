import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { readJsonBody } from '../../lib/http/read-json-body.js';
import { NotifyPrefsBody } from '../../lib/schemas/route-inputs.js';

/**
 * GET /api/me/notify: devolve as preferências de notificação (o padrão, se nunca foram gravadas).
 *
 * Responde 200 com NotifyPrefs, ou 401 sem token válido. Esqueleto: responde 501.
 */
export const getNotifyPrefsRoute = authenticatedRoute(async () => {
  throw new NotImplementedError('ler preferências de notificação não implementado');
});

/**
 * PUT /api/me/notify: grava as preferências de notificação em notifyState/{uid}.prefs.
 *
 * Responde 200 com as NotifyPrefs gravadas, 400 se o corpo for inválido e 401 sem token válido.
 * Esqueleto: responde 501.
 */
export const putNotifyPrefsRoute = authenticatedRoute(async ({ request }) => {
  await readJsonBody(request, NotifyPrefsBody);
  throw new NotImplementedError('gravar preferências de notificação não implementado');
});

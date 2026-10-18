import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { readJsonBody } from '../../lib/http/read-json-body.js';
import { readNotifyPrefs, saveNotifyPrefs } from '../../lib/notify/prefs.js';
import { NotifyPrefsBody } from '../../lib/schemas/route-inputs.js';

/**
 * GET /api/me/notify: devolve as preferências de notificação (o padrão, se nunca foram gravadas).
 *
 * Responde 200 com NotifyPrefs, ou 401 sem token válido.
 */
export const getNotifyPrefsRoute = authenticatedRoute(async ({ uid, dependencies }) =>
  Response.json(await readNotifyPrefs(dependencies.db, uid)),
);

/**
 * PUT /api/me/notify: grava as preferências de notificação em notifyState/{uid}.prefs.
 *
 * Responde 200 com as NotifyPrefs gravadas, 400 se o corpo for inválido e 401 sem token válido.
 */
export const putNotifyPrefsRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const prefs = await readJsonBody(request, NotifyPrefsBody);
  await saveNotifyPrefs(dependencies.db, uid, prefs);
  return Response.json(prefs);
});

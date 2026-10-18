import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { readJsonBody } from '../../lib/http/read-json-body.js';
import { RegisterDeviceBody, UnregisterDeviceBody } from '../../lib/schemas/route-inputs.js';

/**
 * POST /api/me/devices: registra o token do FCM do aparelho em devices/{uid}/tokens/{sha256}.
 *
 * Responde 204, 400 se o corpo for inválido e 401 sem token válido. Esqueleto: responde 501.
 */
export const registerDeviceRoute = authenticatedRoute(async ({ request }) => {
  await readJsonBody(request, RegisterDeviceBody);
  throw new NotImplementedError('registrar aparelho não implementado');
});

/**
 * DELETE /api/me/devices: esquece o token do FCM do aparelho (ao sair da conta).
 *
 * Responde 204, 400 se o corpo for inválido e 401 sem token válido. Esqueleto: responde 501.
 */
export const unregisterDeviceRoute = authenticatedRoute(async ({ request }) => {
  await readJsonBody(request, UnregisterDeviceBody);
  throw new NotImplementedError('remover aparelho não implementado');
});

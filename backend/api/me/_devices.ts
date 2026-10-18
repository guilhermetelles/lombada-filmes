import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { readJsonBody } from '../../lib/http/read-json-body.js';
import { registerDevice, unregisterDevice } from '../../lib/notify/devices.js';
import { RegisterDeviceBody, UnregisterDeviceBody } from '../../lib/schemas/route-inputs.js';

/**
 * POST /api/me/devices `{ token, platform }`: registra (ou renova) o token do FCM do aparelho em
 * devices/{uid}/tokens/{sha256}. Cada pessoa guarda até 5 aparelhos; o mais antigo sai.
 *
 * Responde 204, 400 se o corpo for inválido e 401 sem token válido.
 */
export const registerDeviceRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const device = await readJsonBody(request, RegisterDeviceBody);
  await registerDevice(dependencies.db, uid, device, dependencies.now());
  return new Response(null, { status: 204 });
});

/**
 * DELETE /api/me/devices `{ token }`: esquece o token do FCM do aparelho (ao sair da conta).
 *
 * Responde 204 (mesmo se o token não estava registrado), 400 se o corpo for inválido e 401 sem
 * token válido.
 */
export const unregisterDeviceRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const { token } = await readJsonBody(request, UnregisterDeviceBody);
  await unregisterDevice(dependencies.db, uid, token);
  return new Response(null, { status: 204 });
});

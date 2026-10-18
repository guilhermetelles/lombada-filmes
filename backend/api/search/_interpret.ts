import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { readJsonBody } from '../../lib/http/read-json-body.js';
import { InterpretBody } from '../../lib/schemas/route-inputs.js';

/**
 * POST /api/search/interpret: transforma um texto livre em filtros da busca avançada (Gemini), com
 * limite de 30 por pessoa por dia.
 *
 * Responde 200 `{ filters, explanation }`, 400 se o corpo for inválido, 401 sem token válido, 429
 * acima do limite diário e 502 se o Gemini falhar. Esqueleto: responde 501.
 */
export const interpretRoute = authenticatedRoute(async ({ request }) => {
  await readJsonBody(request, InterpretBody);
  throw new NotImplementedError('interpretação da busca não implementado');
});

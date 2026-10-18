import { consumeInterpretQuota } from '../../lib/discover/interpret-rate-limit.js';
import { interpretText } from '../../lib/discover/interpret-text.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { readJsonBody } from '../../lib/http/read-json-body.js';
import { InterpretBody } from '../../lib/schemas/route-inputs.js';

/**
 * POST /api/search/interpret: transforma um texto livre em filtros da busca avançada (Gemini), com
 * limite de 30 por pessoa por dia no fuso de Brasília, contado antes de chamar o Gemini.
 *
 * Responde 200 `{ filters, explanation }`, 400 se o corpo for inválido, 401 sem token válido, 429
 * `rate_limited` acima do limite diário (sem chamar o Gemini) e 502 se o Gemini falhar ou não
 * tiver chave.
 */
export const interpretRoute = authenticatedRoute(async ({ request, uid, dependencies, usage }) => {
  const { text } = await readJsonBody(request, InterpretBody);
  await consumeInterpretQuota(dependencies.db, uid, dependencies.now());
  const result = await usage.track('gemini', () => interpretText(dependencies.sources.gemini, text));
  return Response.json(result);
});

import { consumeInterpretQuota } from '../../lib/discover/interpret-rate-limit.js';
import { interpretText } from '../../lib/discover/interpret-text.js';
import { resolveKeywords } from '../../lib/discover/resolve-keywords.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { readJsonBody } from '../../lib/http/read-json-body.js';
import { InterpretBody } from '../../lib/schemas/route-inputs.js';
import type { InterpretResult } from '../../lib/types/discover.js';

/**
 * POST /api/search/interpret: transforma um texto livre em filtros da busca avançada (Gemini), com
 * limite de 30 por pessoa por dia no fuso de Brasília, contado antes de chamar o Gemini. Os termos
 * que os filtros não cobrem viram palavras-chave do TMDb (com id), para a busca completar os filtros.
 *
 * Responde 200 `{ filters, explanation, keywords }`, 400 se o corpo for inválido, 401 sem token válido, 429
 * `rate_limited` acima do limite diário (sem chamar o Gemini) e 502 se o Gemini falhar ou não
 * tiver chave.
 */
export const interpretRoute = authenticatedRoute(async ({ request, uid, dependencies, usage }) => {
  const { text } = await readJsonBody(request, InterpretBody);
  await consumeInterpretQuota(dependencies.db, uid, dependencies.now());
  const reply = await interpretText(dependencies.sources.gemini, text, usage);
  const keywords = await resolveKeywords(
    { db: dependencies.db, tmdb: dependencies.sources.tmdbDiscover, usage, now: dependencies.now },
    reply.keywords,
  );
  const result: InterpretResult = { filters: reply.filters, explanation: reply.explanation, keywords };
  return Response.json(result);
});

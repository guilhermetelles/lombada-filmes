import { NotImplementedError } from '../lib/errors/app-errors.js';
import { authenticatedRoute } from '../lib/http/authenticated-route.js';
import { parseInput } from '../lib/http/parse-input.js';
import { DiscoverQuery } from '../lib/schemas/route-inputs.js';

/**
 * GET /api/discover?listId=&mood=&dur=&dec=&genre=&theme=&svc=&fit=&page=: busca avançada no TMDb
 * (região BR), ordenada pela compatibilidade com a lista.
 *
 * Responde 200 `{ results, page, totalPages }`, 400 se a query for inválida e 401 sem token válido.
 * Esqueleto: responde 501.
 */
export const discoverRoute = authenticatedRoute(async ({ request }) => {
  parseInput(DiscoverQuery, Object.fromEntries(new URL(request.url).searchParams));
  throw new NotImplementedError('busca avançada não implementado');
});

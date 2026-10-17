import { getProductionDependencies } from '../../lib/dependencies.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { parseInput } from '../../lib/http/parse-input.js';
import { SearchQuery } from '../../lib/schemas/route-inputs.js';

/**
 * GET /api/search?q=: busca no TMDb em pt-BR e devolve só o que a lista de resultados mostra.
 *
 * Responde 200 `{ results }`, 400 se q estiver vazio ou passar de 100 caracteres, 401 sem token
 * válido e 502 se o TMDb falhar.
 */
export const searchRoute = authenticatedRoute(async ({ request, dependencies, usage }) => {
  const { q } = parseInput(SearchQuery, { q: new URL(request.url).searchParams.get('q') ?? '' });
  const results = await usage.track('tmdb', () => dependencies.sources.tmdb.search(q));
  return Response.json({ results });
});

/** Handler que a Vercel chama em GET /api/search. */
export const GET = searchRoute(getProductionDependencies);

import { getProductionDependencies } from '../../lib/dependencies.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { parseInput } from '../../lib/http/parse-input.js';
import { PersonSearchQuery } from '../../lib/schemas/route-inputs.js';

/**
 * GET /api/search/people?q=: busca atores e diretores no TMDb, para o grupo "Pessoas" da busca do
 * app. Sem cache: busca é efêmera. Tocar numa pessoa chama GET /api/people/{personId}.
 *
 * Responde 200 `{ results: [{ personId, name, department, profilePath, knownFor }] }`, 400 se q
 * tiver menos de 2 ou mais de 100 caracteres, 401 sem token válido e 502 se o TMDb falhar.
 */
export const searchPeopleRoute = authenticatedRoute(async ({ request, dependencies, usage }) => {
  const { q } = parseInput(PersonSearchQuery, { q: new URL(request.url).searchParams.get('q') ?? '' });
  const results = await usage.track('tmdb', () => dependencies.sources.tmdb.searchPeople(q));
  return Response.json({ results });
});

/** Handler que a Vercel chama em GET /api/search/people. */
export const GET = searchPeopleRoute(getProductionDependencies);

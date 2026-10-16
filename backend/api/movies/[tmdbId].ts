import { getProductionDependencies } from '../../lib/dependencies.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { parseInput } from '../../lib/http/parse-input.js';
import { readPathParam } from '../../lib/http/path-param.js';
import { getFreshMovie } from '../../lib/movies/get-fresh-movie.js';
import { MovieParams } from '../../lib/schemas/route-inputs.js';

/**
 * GET /api/movies/{tmdbId}: garante movies/{tmdbId} fresco (7 dias por fonte) e devolve o
 * documento, com as datas em texto ISO.
 *
 * Responde 200 com o filme, 400 se o tmdbId for inválido, 401 sem token válido, 404 se o TMDb não
 * tiver o filme e 502 se o TMDb falhar na primeira busca.
 */
export const movieRoute = authenticatedRoute(async ({ request, dependencies, usage }) => {
  const { tmdbId } = parseInput(MovieParams, { tmdbId: readPathParam(new URL(request.url), 'tmdbId', 2) });
  const movie = await getFreshMovie(tmdbId, dependencies, usage);
  return Response.json({ tmdbId, ...movie });
});

export const GET = movieRoute(getProductionDependencies);

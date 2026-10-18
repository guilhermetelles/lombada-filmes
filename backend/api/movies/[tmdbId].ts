import { getProductionDependencies } from '../../lib/dependencies.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { parseInput } from '../../lib/http/parse-input.js';
import { readPathParam } from '../../lib/http/read-path-param.js';
import { getFreshMovie } from '../../lib/movies/get-fresh-movie.js';
import { movieCompat } from '../../lib/recs/movie-compat.js';
import { MovieParams, MovieQuery } from '../../lib/schemas/route-inputs.js';

/**
 * GET /api/movies/{tmdbId}?listId=: garante movies/{tmdbId} fresco (7 dias por fonte) e devolve o
 * documento, com as datas em texto ISO. Com `listId` de uma lista da pessoa, acrescenta
 * `compat: { score, reason }` calculada com o modelo de recs/current (sem modelo, o campo não vem).
 *
 * Responde 200 com o filme, 400 se o tmdbId ou o listId forem inválidos, 401 sem token válido, 403
 * se a pessoa não for integrante da lista, 404 se o TMDb não tiver o filme (ou a lista não existir)
 * e 502 se o TMDb falhar na primeira busca.
 */
export const movieRoute = authenticatedRoute(async ({ request, uid, dependencies, usage }) => {
  const url = new URL(request.url);
  const { tmdbId } = parseInput(MovieParams, { tmdbId: readPathParam(url, 'tmdbId') });
  const { listId } = parseInput(MovieQuery, { listId: url.searchParams.get('listId') ?? undefined });
  const movie = await getFreshMovie(tmdbId, dependencies, usage);
  const compat = listId ? await movieCompat(dependencies.db, { uid, listId, tmdbId, movie }) : undefined;
  return Response.json({ tmdbId, ...movie, ...(compat && { compat }) });
});

/** Handler que a Vercel chama em GET /api/movies/{tmdbId}. */
export const GET = movieRoute(getProductionDependencies);

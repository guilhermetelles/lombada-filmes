import { discoverMovies } from '../lib/discover/discover-movies.js';
import { getProductionTmdbDiscover } from '../lib/discover/production-tmdb-discover.js';
import type { TmdbDiscoverClient } from '../lib/discover/tmdb-discover-client.js';
import { authenticatedRoute } from '../lib/http/authenticated-route.js';
import { parseInput } from '../lib/http/parse-input.js';
import { requireMember } from '../lib/lists/list-access.js';
import { listDocument } from '../lib/lists/list-repository.js';
import { DiscoverQuery } from '../lib/schemas/route-inputs.js';

/**
 * GET /api/discover?listId=&mood=&dur=&dec=&genre=&theme=&svc=&fit=&page=: busca avançada no TMDb
 * (região BR), ordenada pela compatibilidade com a lista. Com `listId`, só membros da lista; sem
 * ele, a nota de cada filme é a do TMDb.
 *
 * Responde 200 `{ results, page, totalPages }`, 400 se a query for inválida, 401 sem token válido,
 * 403 se a pessoa não for membro da lista, 404 se a lista não existir e 502 se o TMDb falhar.
 *
 * @param getTmdb - Dá o cliente do TMDb da busca (o de produção, ou um com fetch falso nos testes).
 * @returns A rota, pronta para receber as dependências.
 */
export const discoverRouteWith = (getTmdb: () => TmdbDiscoverClient) =>
  authenticatedRoute(async ({ request, uid, dependencies, usage }) => {
    const { listId, page, ...filters } = parseInput(
      DiscoverQuery,
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (listId) requireMember((await listDocument(dependencies.db, listId).get()).data(), uid);
    const result = await discoverMovies({ db: dependencies.db, tmdb: getTmdb(), usage }, { filters, page, listId });
    return Response.json(result);
  });

/** GET /api/discover com o cliente do TMDb de produção (a tabela de api/router.ts usa este). */
export const discoverRoute = discoverRouteWith(getProductionTmdbDiscover);

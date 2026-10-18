import { NotImplementedError } from '../../../../lib/errors/app-errors.js';
import { authenticatedRoute } from '../../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../../lib/http/parse-input.js';
import { readPathParam } from '../../../../lib/http/read-path-param.js';
import { QueueItemParams } from '../../../../lib/schemas/route-inputs.js';

/** Posição do tmdbId em /api/lists/{listId}/queue/{tmdbId}, contando "api" como 0. */
const TMDB_ID_POSITION = 4;

/**
 * DELETE /api/lists/{listId}/queue/{tmdbId}: tira um filme da fila "Quero ver" da lista.
 *
 * Responde 204, 400 se a entrada for inválida, 401 sem token válido, 403 para quem não é integrante
 * e 404 se a lista não existir. Esqueleto: responde 501.
 */
export const removeFromQueueRoute = authenticatedRoute(async ({ request }) => {
  const url = new URL(request.url);
  parseInput(QueueItemParams, {
    listId: readPathParam(url, 'listId'),
    tmdbId: readPathParam(url, 'tmdbId', TMDB_ID_POSITION),
  });
  throw new NotImplementedError('tirar da fila não implementado');
});

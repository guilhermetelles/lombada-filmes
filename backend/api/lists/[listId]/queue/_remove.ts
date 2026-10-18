import { authenticatedRoute } from '../../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../../lib/http/parse-input.js';
import { readPathParam } from '../../../../lib/http/read-path-param.js';
import { removeFromQueue } from '../../../../lib/queue/remove-from-queue.js';
import { QueueItemParams } from '../../../../lib/schemas/route-inputs.js';

/** Posição do tmdbId em /api/lists/{listId}/queue/{tmdbId}, contando "api" como 0. */
const TMDB_ID_POSITION = 4;

/**
 * DELETE /api/lists/{listId}/queue/{tmdbId}: tira um filme da fila "Quero ver" da lista.
 *
 * Responde 204 (mesmo se o filme não estava na fila), 400 se a entrada for inválida, 401 sem token
 * válido, 403 para quem não é integrante e 404 se a lista não existir.
 */
export const removeFromQueueRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const url = new URL(request.url);
  const { listId, tmdbId } = parseInput(QueueItemParams, {
    listId: readPathParam(url, 'listId'),
    tmdbId: readPathParam(url, 'tmdbId', TMDB_ID_POSITION),
  });
  await removeFromQueue(dependencies, { uid, listId, tmdbId });
  return new Response(null, { status: 204 });
});

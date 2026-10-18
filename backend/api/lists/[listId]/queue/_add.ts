import { authenticatedRoute } from '../../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../../lib/http/parse-input.js';
import { readJsonBody } from '../../../../lib/http/read-json-body.js';
import { readPathParam } from '../../../../lib/http/read-path-param.js';
import { addToQueue } from '../../../../lib/queue/add-to-queue.js';
import { AddToQueueBody, ListParams } from '../../../../lib/schemas/route-inputs.js';

/**
 * POST /api/lists/{listId}/queue `{ tmdbId }`: põe um filme na fila "Quero ver" da lista e gera
 * item na Atividade. Pedir de novo um filme que já está na fila responde 201 sem duplicar nada.
 *
 * Responde 201 `{ tmdbId }`, 400 se a entrada for inválida, 401 sem token válido, 403 para quem não
 * é integrante, 404 se a lista ou o filme não existirem, 409 `conflict` se o filme já estiver nas
 * entradas da lista e 502 se o TMDb falhar com o filme ainda não guardado.
 */
export const addToQueueRoute = authenticatedRoute(async ({ request, uid, dependencies, usage }) => {
  const { listId } = parseInput(ListParams, { listId: readPathParam(new URL(request.url), 'listId') });
  const { tmdbId } = await readJsonBody(request, AddToQueueBody);
  await addToQueue(dependencies, usage, { uid, listId, tmdbId });
  return Response.json({ tmdbId }, { status: 201 });
});

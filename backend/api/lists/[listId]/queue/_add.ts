import { NotImplementedError } from '../../../../lib/errors/app-errors.js';
import { authenticatedRoute } from '../../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../../lib/http/parse-input.js';
import { readJsonBody } from '../../../../lib/http/read-json-body.js';
import { readPathParam } from '../../../../lib/http/read-path-param.js';
import { AddToQueueBody, ListParams } from '../../../../lib/schemas/route-inputs.js';

/**
 * POST /api/lists/{listId}/queue: põe um filme na fila "Quero ver" da lista e gera item na Atividade.
 *
 * Responde 201 `{ tmdbId }`, 400 se a entrada for inválida, 401 sem token válido, 403 para quem não
 * é integrante e 404 se a lista ou o filme não existirem. Esqueleto: responde 501.
 */
export const addToQueueRoute = authenticatedRoute(async ({ request }) => {
  parseInput(ListParams, { listId: readPathParam(new URL(request.url), 'listId') });
  await readJsonBody(request, AddToQueueBody);
  throw new NotImplementedError('adicionar à fila não implementado');
});

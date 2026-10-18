import { NotImplementedError } from '../../../lib/errors/app-errors.js';
import { authenticatedRoute } from '../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../lib/http/parse-input.js';
import { readJsonBody } from '../../../lib/http/read-json-body.js';
import { readPathParam } from '../../../lib/http/read-path-param.js';
import { ListEventsBody, ListParams } from '../../../lib/schemas/route-inputs.js';

/**
 * POST /api/lists/{listId}/events: lote de eventos do app (entrada nova, mudança de posição,
 * comentário). Grava a Atividade e manda no máximo um aviso agrupado por destinatário.
 *
 * Responde 202 `{ pushed }`, 400 se a entrada for inválida, 401 sem token válido, 403 para quem não
 * é integrante e 404 se a lista não existir. Esqueleto: responde 501.
 */
export const listEventsRoute = authenticatedRoute(async ({ request }) => {
  parseInput(ListParams, { listId: readPathParam(new URL(request.url), 'listId') });
  await readJsonBody(request, ListEventsBody);
  throw new NotImplementedError('eventos da lista não implementado');
});

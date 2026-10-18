import { processListEvents } from '../../../lib/events/process-list-events.js';
import { authenticatedRoute } from '../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../lib/http/parse-input.js';
import { readJsonBody } from '../../../lib/http/read-json-body.js';
import { readPathParam } from '../../../lib/http/read-path-param.js';
import { ListEventsBody, ListParams } from '../../../lib/schemas/route-inputs.js';

/**
 * POST /api/lists/{listId}/events: lote de eventos do app (entrada nova, mudança de posição,
 * comentário). Aceita só os eventos que o banco confirma (entrada gravada por quem pede nos
 * últimos 30 minutos), tira da fila os filmes que viraram entrada, grava um item na Atividade com
 * o resumo do lote e manda no máximo um aviso agrupado por destinatário.
 *
 * Responde 202 `{ pushed }`, 400 se a entrada for inválida, 401 sem token válido, 403 para quem não
 * é integrante e 404 se a lista não existir.
 */
export const listEventsRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const { listId } = parseInput(ListParams, { listId: readPathParam(new URL(request.url), 'listId') });
  const { items } = await readJsonBody(request, ListEventsBody);
  const pushed = await processListEvents(dependencies, { uid, listId, items });
  return Response.json({ pushed }, { status: 202 });
});

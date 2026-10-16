import { getProductionDependencies } from '../../../lib/dependencies.js';
import { authenticatedRoute } from '../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../lib/http/parse-input.js';
import { readPathParam } from '../../../lib/http/path-param.js';
import { leaveList } from '../../../lib/lists/leave-list.js';
import { ListParams } from '../../../lib/schemas/route-inputs.js';

/**
 * POST /api/lists/{listId}/leave: tira quem chamou da lista. Se a dona sair, a posse passa para a
 * próxima integrante; se ninguém sobrar, a lista, as entradas e os convites são apagados.
 *
 * Responde 200 `{ listDeleted }`, 400 se o listId for inválido, 401 sem token válido, 403 para quem
 * não é integrante e 404 se a lista não existir.
 */
export const leaveListRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const { listId } = parseInput(ListParams, { listId: readPathParam(new URL(request.url), 'listId', 2) });
  return Response.json(await leaveList(dependencies.db, uid, listId, dependencies.now()));
});

export const POST = leaveListRoute(getProductionDependencies);

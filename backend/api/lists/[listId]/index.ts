import { getProductionDependencies } from '../../../lib/dependencies.js';
import { authenticatedRoute } from '../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../lib/http/parse-input.js';
import { readPathParam } from '../../../lib/http/read-path-param.js';
import { deleteList } from '../../../lib/lists/delete-list.js';
import { ListParams } from '../../../lib/schemas/route-inputs.js';

/**
 * DELETE /api/lists/{listId}: a dona apaga a lista, as entradas e os códigos de convite.
 *
 * Responde 204, 400 se o listId for inválido, 401 sem token válido, 403 para quem não é a dona e
 * 404 se a lista não existir.
 */
export const deleteListRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const { listId } = parseInput(ListParams, { listId: readPathParam(new URL(request.url), 'listId') });
  await deleteList(dependencies.db, uid, listId);
  return new Response(null, { status: 204 });
});

/** Handler que a Vercel chama em DELETE /api/lists/{listId}. */
export const DELETE = deleteListRoute(getProductionDependencies);

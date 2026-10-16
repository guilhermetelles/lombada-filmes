import { getProductionDependencies } from '../../lib/dependencies.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { readJsonBody } from '../../lib/http/read-json-body.js';
import { joinList } from '../../lib/lists/join-list.js';
import { JoinListBody } from '../../lib/schemas/route-inputs.js';

/**
 * POST /api/lists/join `{ code }`: entra numa lista com um código de convite ("7Q4-KMX" ou
 * "7q4kmx"). Quem já é integrante só recebe a lista de volta.
 *
 * Responde 200 `{ listId, name, description, alreadyMember }`, 400 se o código for malformado,
 * 401 sem token válido, 404 se o código ou a lista não existirem e 410 se o código tiver vencido.
 */
export const joinListRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const { code } = await readJsonBody(request, JoinListBody);
  return Response.json(await joinList(dependencies.db, uid, code, dependencies.now()));
});

export const POST = joinListRoute(getProductionDependencies);

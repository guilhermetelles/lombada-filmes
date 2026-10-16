import { getProductionDependencies } from '../../lib/dependencies.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { readJsonBody } from '../../lib/http/read-json-body.js';
import { createList } from '../../lib/lists/create-list.js';
import { CreateListBody } from '../../lib/schemas/route-inputs.js';

/**
 * POST /api/lists `{ name, description? }`: cria a lista com quem chamou como dona e única
 * integrante, e o primeiro código de convite (7 dias).
 *
 * Responde 201 `{ listId, inviteCode, expiresAt }`, 400 se o corpo for inválido e 401 sem token válido.
 */
export const createListRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const newList = await readJsonBody(request, CreateListBody);
  const created = await createList(dependencies.db, uid, newList, dependencies.now());
  return Response.json(created, { status: 201 });
});

export const POST = createListRoute(getProductionDependencies);

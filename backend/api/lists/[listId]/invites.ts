import { getProductionDependencies } from '../../../lib/dependencies.js';
import { authenticatedRoute } from '../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../lib/http/parse-input.js';
import { readPathParam } from '../../../lib/http/read-path-param.js';
import { createInvite } from '../../../lib/lists/create-invite.js';
import { ListParams } from '../../../lib/schemas/route-inputs.js';

/**
 * POST /api/lists/{listId}/invites: qualquer integrante gera um código de convite novo, de 7 dias.
 *
 * Responde 201 `{ inviteCode, expiresAt }`, 400 se o listId for inválido, 401 sem token válido,
 * 403 para quem não é integrante e 404 se a lista não existir.
 */
export const createInviteRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const { listId } = parseInput(ListParams, { listId: readPathParam(new URL(request.url), 'listId') });
  const created = await createInvite(dependencies.db, uid, listId, dependencies.now());
  return Response.json(created, { status: 201 });
});

/** Handler que a Vercel chama em POST /api/lists/{listId}/invites. */
export const POST = createInviteRoute(getProductionDependencies);

import { openDuel } from '../../../../lib/duel/open-duel.js';
import { authenticatedRoute } from '../../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../../lib/http/parse-input.js';
import { readPathParam } from '../../../../lib/http/read-path-param.js';
import { DuelQuery } from '../../../../lib/schemas/route-inputs.js';

/**
 * GET /api/lists/{listId}/duel?entryIdA=&entryIdB=: o duelo de hoje, criado na primeira abertura com
 * o par da notificação (se as duas entradas ainda estão na lista) ou com o sorteio do dia.
 *
 * Responde 200 `DuelView`, 400 se a entrada for inválida, 401 sem token válido, 403 para quem não é
 * integrante e 404 se a lista não existir ou tiver menos de dois filmes.
 */
export const getDuelRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const url = new URL(request.url);
  const { listId, entryIdA, entryIdB } = parseInput(DuelQuery, {
    listId: readPathParam(url, 'listId'),
    entryIdA: url.searchParams.get('entryIdA') || undefined,
    entryIdB: url.searchParams.get('entryIdB') || undefined,
  });
  return Response.json(await openDuel(dependencies, { uid, listId, entryIdA, entryIdB }));
});

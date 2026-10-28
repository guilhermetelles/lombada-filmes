import { voteDuel } from '../../../../lib/duel/vote-duel.js';
import { authenticatedRoute } from '../../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../../lib/http/parse-input.js';
import { readJsonBody } from '../../../../lib/http/read-json-body.js';
import { readPathParam } from '../../../../lib/http/read-path-param.js';
import { DuelVoteBody, DuelVoteParams } from '../../../../lib/schemas/route-inputs.js';

/** Posição do dia em /api/lists/{listId}/duel/{dia}/vote, contando "api" como 0. */
const DAY_POSITION = 4;

/**
 * POST /api/lists/{listId}/duel/{dia}/vote `{ choice }`: vota no duelo de hoje. Um `keep` fecha o
 * duelo como mantido; o último `swap` que completa a unanimidade troca as duas entradas.
 *
 * Responde 200 `DuelView`, 400 se a entrada for inválida ou o dia não for hoje em Brasília, 401 sem
 * token válido, 403 para quem não é integrante, 404 sem duelo no dia e 409 se o duelo já fechou ou um
 * dos filmes saiu da lista.
 */
export const voteDuelRoute = authenticatedRoute(async ({ request, uid, dependencies }) => {
  const url = new URL(request.url);
  const { listId, day } = parseInput(DuelVoteParams, {
    listId: readPathParam(url, 'listId'),
    day: readPathParam(url, 'day', DAY_POSITION),
  });
  const { choice } = await readJsonBody(request, DuelVoteBody);
  return Response.json(await voteDuel(dependencies, { uid, listId, day, choice }));
});

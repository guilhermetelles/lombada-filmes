import { getProductionDependencies } from '../../lib/dependencies.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { parseInput } from '../../lib/http/parse-input.js';
import { readPathParam } from '../../lib/http/path-param.js';
import { getFreshPerson } from '../../lib/people/get-fresh-person.js';
import { PersonParams } from '../../lib/schemas/route-inputs.js';

/**
 * GET /api/people/{personId}: garante people/{personId} fresco (30 dias) e devolve o documento, com
 * a data em texto ISO. Serve a tela do diretor; a foto é image.tmdb.org/t/p/w185{profilePath}.
 *
 * Responde 200 com a pessoa, 400 se o personId for inválido, 401 sem token válido, 404 se o TMDb
 * não tiver a pessoa e 502 se o TMDb falhar na primeira busca.
 */
export const personRoute = authenticatedRoute(async ({ request, dependencies, usage }) => {
  const { personId } = parseInput(PersonParams, { personId: readPathParam(new URL(request.url), 'personId', 2) });
  const person = await getFreshPerson(personId, dependencies, usage);
  return Response.json({ personId, ...person });
});

export const GET = personRoute(getProductionDependencies);

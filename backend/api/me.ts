import { getProductionDependencies } from '../lib/dependencies.js';
import { authenticatedRoute } from '../lib/http/authenticated-route.js';
import { syncProfileInLists } from '../lib/lists/sync-member-profiles.js';

/**
 * GET /api/me: devolve o uid de quem chamou e copia o nome e a foto atuais do Google para
 * memberProfiles das listas da pessoa (só onde mudou). O app chama ao abrir.
 *
 * Responde 200 `{ uid, profileSynced }` (em quantas listas o perfil foi gravado), ou 401 sem token válido.
 */
export const meRoute = authenticatedRoute(async ({ uid, dependencies }) => {
  const profileSynced = await syncProfileInLists(dependencies, uid);
  return Response.json({ uid, profileSynced });
});

/** Handler que a Vercel chama em GET /api/me. */
export const GET = meRoute(getProductionDependencies);

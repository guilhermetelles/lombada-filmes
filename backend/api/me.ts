import { getProductionDependencies } from '../lib/dependencies.js';
import { authenticatedRoute } from '../lib/http/authenticated-route.js';

/**
 * GET /api/me: devolve o uid de quem chamou. Serve para o app conferir que o login chega ao backend.
 *
 * Responde 200 `{ uid }`, ou 401 sem token válido.
 */
export const meRoute = authenticatedRoute(async ({ uid }) => Response.json({ uid }));

/** Handler que a Vercel chama em GET /api/me. */
export const GET = meRoute(getProductionDependencies);

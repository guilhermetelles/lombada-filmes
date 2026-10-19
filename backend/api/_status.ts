import { authenticatedRoute } from '../lib/http/authenticated-route.js';
import { readStatus } from '../lib/status/read-status.js';

/**
 * GET /api/status: saúde das rotinas (jobs/{nome}), consumo das fontes e de cada modelo do Gemini
 * nos últimos 7 dias e os modelos do Gemini em uso, para a tela de status do app.
 *
 * Responde 200 `{ jobs, usage, gemini }`, 401 sem token válido e 403 para quem não é membro de
 * nenhuma lista.
 */
export const statusRoute = authenticatedRoute(async ({ uid, dependencies }) =>
  Response.json(await readStatus(dependencies, uid)),
);

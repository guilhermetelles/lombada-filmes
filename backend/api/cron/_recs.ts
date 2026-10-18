import { cronRoute } from '../../lib/http/cron-route.js';
import { logger } from '../../lib/logging/logger.js';
import { runRecs } from '../../lib/recs/run-recs.js';

/**
 * GET /api/cron/recs: rotina das 05h de Brasília (vercel.json). Calcula recs/current de cada lista:
 * candidatos e variáveis só do TMDb, modelo de pares do ranking, vizinhos, variedade e motivos pelo
 * Gemini (reserva por variáveis). Para de buscar no TMDb por volta de 240 s; listas que ficarem de
 * fora vêm primeiro na próxima execução.
 *
 * Responde 200 com o relatório, ou 401 sem o `Authorization: Bearer <CRON_SECRET>` que a Vercel manda.
 */
export const recsCronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runRecs(dependencies, usage);
  logger.info('rotina recs concluída', { report });
  return Response.json(report);
});

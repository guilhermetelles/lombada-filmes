import { getProductionDependencies } from '../../lib/dependencies.js';
import { cronRoute } from '../../lib/http/cron-route.js';
import { logger } from '../../lib/logging/logger.js';
import { runDailyMaintenance } from '../../lib/maintenance/run-daily-maintenance.js';

/**
 * GET /api/cron/daily: rotina diária agendada em vercel.json (6h de Brasília). Atualiza as notas
 * vencidas de até 100 filmes (sem buscar o TMDb nem pessoas, que são atualizados ao abrir a página) e apaga os códigos de convite vencidos.
 *
 * Responde 200 com o relatório, ou 401 sem o `Authorization: Bearer <CRON_SECRET>` que a Vercel manda.
 */
export const dailyCronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runDailyMaintenance(dependencies, usage);
  logger.info('rotina diária concluída', { report });
  return Response.json(report);
});

/** Handler que a Vercel chama em GET /api/cron/daily. */
export const GET = dailyCronRoute(getProductionDependencies);

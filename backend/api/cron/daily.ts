import { getProductionDependencies } from '../../lib/dependencies.js';
import { cronRoute } from '../../lib/http/cron-route.js';
import { logger } from '../../lib/logging/logger.js';
import { runDailyMaintenance } from '../../lib/maintenance/run-daily-maintenance.js';

/**
 * GET /api/cron/daily: rotina diária agendada em vercel.json (6h de Brasília). Atualiza as notas
 * vencidas de até 100 filmes (sem buscar o TMDb nem pessoas, que são atualizados ao abrir a página),
 * atualiza o Teste de Bechdel pelo índice do site (e casa até 30 filmes novos), apaga os códigos de
 * convite vencidos e limpa a Atividade com mais de 180 dias, o notifyLog e o rateLimits com mais de
 * 45 dias.
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

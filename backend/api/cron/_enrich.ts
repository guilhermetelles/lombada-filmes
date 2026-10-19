import { runEnrich } from '../../lib/enrich/run-enrich.js';
import { cronRoute } from '../../lib/http/cron-route.js';
import { runJob } from '../../lib/jobs/job-health.js';
import { describeEnrich } from '../../lib/jobs/job-outcomes.js';
import { logger } from '../../lib/logging/logger.js';

/**
 * GET /api/cron/enrich: rotina das 04h de Brasília (vercel.json). Busca os campos extras de movies
 * (TMDb, OMDb Awards/BoxOffice, Wikidata em uma consulta por lote, Wikipedia para a Framboesa de
 * Ouro), o providersBR da fila (uma vez por dia) e a ficha e os prêmios das pessoas recorrentes da
 * lista, com frescor de 30 dias. Para por volta de 240 s com o cursor em jobs/enrich; chamada de
 * novo no mesmo dia, continua de onde parou.
 *
 * Grava a saúde da execução em jobs/enrich. Responde 200 com o relatório, ou 401 sem o `Authorization:
 * Bearer <CRON_SECRET>` que a Vercel manda.
 */
export const enrichCronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runJob({ dependencies, usage }, 'enrich', () => runEnrich(dependencies, usage), describeEnrich);
  logger.info('rotina enrich concluída', { report });
  return Response.json(report);
});

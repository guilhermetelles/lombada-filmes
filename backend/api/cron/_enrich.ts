import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { cronRoute } from '../../lib/http/cron-route.js';

/**
 * GET /api/cron/enrich: rotina das 04h de Brasília (vercel.json). Busca os campos extras de movies
 * (TMDb, OMDb Awards/BoxOffice, Wikidata, Wikipedia), o providersBR da fila e as pessoas recorrentes
 * da lista, com frescor de 30 dias e cursor para continuar.
 *
 * Responde 200 com o relatório, ou 401 sem o segredo do cron. Esqueleto: responde 501.
 */
export const enrichCronRoute = cronRoute(async () => {
  throw new NotImplementedError('rotina enrich não implementado');
});

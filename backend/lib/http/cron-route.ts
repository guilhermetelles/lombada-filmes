import { timingSafeEqual } from 'node:crypto';
import { UnauthenticatedError } from '../errors/app-errors.js';
import type { CronContext, GetDependencies, RouteHandler } from '../types/http.js';
import { runRoute } from './run-route.js';

/**
 * Cria uma rota chamada pelo Vercel Cron. A Vercel manda `Authorization: Bearer <CRON_SECRET>`;
 * qualquer outro valor responde 401. Erros e consumo ficam com runRoute.
 *
 * @param handle - Corpo da rota; recebe as dependências e o medidor de consumo.
 * @returns Fábrica que, dadas as dependências, devolve o handler chamado pela Vercel.
 */
export function cronRoute(handle: (context: CronContext) => Promise<Response>) {
  return (getDependencies: GetDependencies): RouteHandler =>
    (request) =>
      runRoute(request, getDependencies, async (dependencies, usage) => {
        requireCronSecret(request, dependencies.cronSecret);
        return handle({ dependencies, usage });
      });
}

/**
 * Confere o segredo do cron com comparação em tempo constante, para não vazar o segredo pelo tempo
 * de resposta.
 *
 * @param request - Pedido recebido.
 * @param secret - CRON_SECRET esperado.
 * @throws {UnauthenticatedError} Se o cabeçalho faltar ou não bater.
 */
function requireCronSecret(request: Request, secret: string): void {
  const received = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new UnauthenticatedError('segredo do cron inválido');
  }
}

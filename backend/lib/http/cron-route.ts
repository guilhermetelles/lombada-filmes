import { timingSafeEqual } from 'node:crypto';
import { UnauthenticatedError } from '../errors/app-errors.js';
import { logger } from '../logging/logger.js';
import type { Dependencies } from '../types/dependencies.js';
import type { RouteHandler } from '../types/http.js';
import type { UsageRecorder } from '../types/usage.js';
import { UsageMeter } from '../usage/usage-meter.js';
import { errorResponse } from './error-response.js';

type CronContext = { dependencies: Dependencies; usage: UsageRecorder };

/**
 * Cria uma rota chamada pelo Vercel Cron. A Vercel manda `Authorization: Bearer <CRON_SECRET>`;
 * qualquer outro valor responde 401. O consumo das fontes é gravado no fim, como nas rotas do app.
 *
 * @param handle - Corpo da rota; recebe as dependências e o medidor de consumo.
 * @returns Fábrica que, dadas as dependências, devolve o handler chamado pela Vercel.
 */
export function cronRoute(handle: (context: CronContext) => Promise<Response>) {
  return (getDependencies: () => Dependencies): RouteHandler =>
    async (request) => {
      const usage = new UsageMeter();
      let dependencies: Dependencies | undefined;
      try {
        dependencies = getDependencies();
        requireCronSecret(request, dependencies.cronSecret);
        return await handle({ dependencies, usage });
      } catch (error) {
        return errorResponse(error, request);
      } finally {
        if (dependencies) await saveUsage(usage, dependencies);
      }
    };
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

/**
 * Grava o consumo contado na execução; uma falha aqui só vai para o log.
 *
 * @param usage - Medidor da execução.
 * @param dependencies - Banco e relógio.
 */
async function saveUsage(usage: UsageMeter, { db, now }: Dependencies): Promise<void> {
  try {
    await usage.save(db, now());
  } catch (error) {
    logger.error('falha ao gravar o consumo das APIs', { error });
  }
}

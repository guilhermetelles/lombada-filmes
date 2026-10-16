import { logger } from '../logging/logger.js';
import type { Dependencies } from '../types/dependencies.js';
import type { GetDependencies } from '../types/http.js';
import { UsageMeter } from '../usage/usage-meter.js';
import { errorResponse } from './error-response.js';

/**
 * Roda um pedido de rota: monta as dependências, chama a rota, transforma erros em resposta e, no
 * fim (mesmo se o pedido falhar), grava o consumo das fontes contado no pedido. É o envelope comum
 * de authenticatedRoute e cronRoute.
 *
 * @param request - Pedido recebido.
 * @param getDependencies - Dá as dependências (de produção ou de teste).
 * @param handle - Corpo do pedido; recebe as dependências e o medidor de consumo.
 * @returns A resposta da rota, ou a resposta de erro.
 */
export async function runRoute(
  request: Request,
  getDependencies: GetDependencies,
  handle: (dependencies: Dependencies, usage: UsageMeter) => Promise<Response>,
): Promise<Response> {
  const usage = new UsageMeter();
  let dependencies: Dependencies | undefined;
  try {
    dependencies = getDependencies();
    return await handle(dependencies, usage);
  } catch (error) {
    return errorResponse(error, request);
  } finally {
    if (dependencies) await saveUsage(usage, dependencies);
  }
}

/**
 * Grava o consumo contado no pedido. Uma falha aqui só vai para o log: perder a contagem não deve
 * derrubar a resposta.
 *
 * @param usage - Medidor do pedido.
 * @param dependencies - Banco e relógio.
 */
async function saveUsage(usage: UsageMeter, { db, now }: Dependencies): Promise<void> {
  try {
    await usage.save(db, now());
  } catch (error) {
    logger.error('falha ao gravar o consumo das APIs', { error });
  }
}

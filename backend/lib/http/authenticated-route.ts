import { verifyUser } from '../auth/verify-user.js';
import { logger } from '../logging/logger.js';
import type { Dependencies } from '../types/dependencies.js';
import type { RouteContext, RouteHandler } from '../types/http.js';
import { UsageMeter } from '../usage/usage-meter.js';
import { errorResponse } from './error-response.js';

type GetDependencies = () => Dependencies;

/**
 * Cria uma rota que exige login. Para cada pedido: valida o token, chama a rota, transforma erros
 * em resposta e, no fim (mesmo se o pedido falhar), grava o consumo das fontes contado no pedido.
 *
 * O resultado é uma fábrica que recebe as dependências: o arquivo da rota exporta
 * `GET = minhaRota(getProductionDependencies)`, e os testes chamam `minhaRota(() => dependências)`.
 *
 * @param handle - Corpo da rota; recebe o pedido, o uid, as dependências e o medidor de consumo.
 * @returns Fábrica que, dadas as dependências, devolve o handler chamado pela Vercel.
 */
export function authenticatedRoute(handle: (context: RouteContext) => Promise<Response>) {
  return (getDependencies: GetDependencies): RouteHandler =>
    async (request) => {
      const usage = new UsageMeter();
      let dependencies: Dependencies | undefined;

      try {
        dependencies = getDependencies();
        const uid = await verifyUser(dependencies.auth, request);
        return await handle({ request, uid, dependencies, usage });
      } catch (error) {
        return errorResponse(error, request);
      } finally {
        if (dependencies) await saveUsage(usage, dependencies);
      }
    };
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

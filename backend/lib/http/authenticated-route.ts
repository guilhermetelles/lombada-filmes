import { verifyUser } from '../auth/verify-user.js';
import type { GetDependencies, RouteContext, RouteHandler } from '../types/http.js';
import { runRoute } from './run-route.js';

/**
 * Cria uma rota que exige login: valida o ID token e entrega o uid à rota. Erros e consumo ficam
 * com runRoute.
 *
 * O resultado é uma fábrica que recebe as dependências: o arquivo da rota exporta
 * `GET = minhaRota(getProductionDependencies)`, e os testes chamam `minhaRota(() => dependências)`.
 *
 * @param handle - Corpo da rota; recebe o pedido, o uid, as dependências e o medidor de consumo.
 * @returns Fábrica que, dadas as dependências, devolve o handler chamado pela Vercel.
 */
function authenticatedRoute(handle: (context: RouteContext) => Promise<Response>) {
  return (getDependencies: GetDependencies): RouteHandler =>
    (request) =>
      runRoute(request, getDependencies, async (dependencies, usage) => {
        const uid = await verifyUser(dependencies.auth, request);
        return handle({ request, uid, dependencies, usage });
      });
}

export { authenticatedRoute };

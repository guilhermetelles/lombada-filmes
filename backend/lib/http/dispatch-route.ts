import { NotFoundError } from '../errors/app-errors.js';
import type { GetDependencies, HttpMethod, RouterEntry } from '../types/http.js';
import { errorResponse } from './error-response.js';

/**
 * Escolhe a rota de um pedido na tabela da função única (api/router.ts) e a chama. Casa primeiro
 * pelo caminho original (/api/lists/x/queue) e, se a Vercel entregar o destino do rewrite
 * (/api/router?route=…), pelo nome em `route`.
 *
 * @param routes - Tabela de rotas.
 * @param method - Método do pedido.
 * @param request - Pedido recebido.
 * @param getDependencies - Dá as dependências (de produção ou de teste).
 * @returns A resposta da rota, ou 404 `not_found` se nenhuma rota ou método casar.
 */
async function dispatchRoute(
  routes: RouterEntry[],
  method: HttpMethod,
  request: Request,
  getDependencies: GetDependencies,
): Promise<Response> {
  const url = new URL(request.url);
  const name = url.searchParams.get('route');
  const entry =
    routes.find((route) => route.path.test(url.pathname)) ??
    routes.find((route) => name !== null && route.name === name);

  const factory = entry?.methods[method];
  if (!factory) return errorResponse(new NotFoundError(`rota não encontrada: ${method} ${url.pathname}`), request);
  return factory(getDependencies)(request);
}

export { dispatchRoute };

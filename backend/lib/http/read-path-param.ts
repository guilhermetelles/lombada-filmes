/** Posição do id do recurso em /api/{coleção}/{id}/…, contando "api" como 0. */
const RESOURCE_ID_POSITION = 2;

/**
 * Lê um segmento dinâmico do caminho, como o [tmdbId] de api/movies/[tmdbId].ts. A Vercel passa o
 * segmento como query com o mesmo nome; a posição no caminho fica de reserva.
 *
 * @param url - Endereço do pedido.
 * @param name - Nome do segmento entre colchetes no arquivo da rota.
 * @param position - Posição do segmento no caminho, contando "api" como 0.
 * @returns O valor como texto, ainda sem validar; vazio se não houver.
 */
function readPathParam(url: URL, name: string, position = RESOURCE_ID_POSITION): string {
  return url.searchParams.get(name) ?? url.pathname.split('/').filter(Boolean)[position] ?? '';
}

export { readPathParam };

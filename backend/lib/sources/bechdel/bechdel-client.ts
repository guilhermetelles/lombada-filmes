import { SourceUnavailableError } from '../../errors/app-errors.js';
import { BechdelIndex } from '../../schemas/sources/bechdel.js';
import type { BechdelClient, Fetch } from '../../types/sources.js';
import { fetchFromSource, fetchJson } from '../shared/fetch-json.js';
import { encodePath, readBechdelPage, readCanonical } from './bechdel-page.js';

/** Endereço do site, base dos caminhos relativos. */
const BECHDEL_ORIGIN = 'https://bechdeltest.com';

/** O site é mantido por voluntários: os pedidos se identificam, com o endereço do app. */
export const BECHDEL_USER_AGENT = 'lombada/1.0 (app pessoal; +https://lombada-lovat.vercel.app)';

/** Cabeçalhos de todo pedido ao site. */
const HEADERS = { 'user-agent': BECHDEL_USER_AGENT };

/**
 * Cria o cliente do bechdeltest.com. O site desligou a API (`/api/v1/*` responde 410), então o
 * cliente lê o índice da busca do site e a página de cada filme.
 *
 * @param options - O fetch a usar.
 * @returns Cliente do índice e das páginas de filme.
 */
export function createBechdelClient({ fetch }: { fetch: Fetch }): BechdelClient {
  /**
   * Baixa uma página do site como texto.
   *
   * @param url - Endereço completo.
   * @returns O HTML da página.
   * @throws {NotFoundError} Se o site responder 404.
   * @throws {SourceUnavailableError} Se o pedido falhar.
   */
  const fetchPage = async (url: string): Promise<string> =>
    (await fetchFromSource(fetch, 'bechdel', url, { headers: HEADERS })).text();

  return {
    /**
     * Baixa o índice com todos os filmes do site (cerca de 390 KB).
     *
     * @returns Os filmes, com id, título, ano, critérios e se a avaliação é duvidosa.
     * @throws {SourceUnavailableError} Se o pedido falhar ou o índice estiver fora do formato.
     */
    async getIndex() {
      return fetchJson(fetch, 'bechdel', `${BECHDEL_ORIGIN}/search/index.json`, BechdelIndex, { headers: HEADERS });
    },

    /**
     * Lê a página de um filme. `/view/{id}/` só redireciona (o endereço final está no link
     * canônico), então são dois pedidos quando o endereço final é outro.
     *
     * @param siteId - Id do filme no site.
     * @returns Endereço final, id do IMDb, critérios, se é duvidosa e quantas contestações.
     * @throws {NotFoundError} Se o site não tiver esse id.
     * @throws {SourceUnavailableError} Se o pedido falhar, o canônico levar a outro filme ou a página estiver fora do formato.
     */
    async getMoviePage(siteId) {
      const shortPath = `/view/${siteId}/`;
      const redirect = await fetchPage(`${BECHDEL_ORIGIN}${shortPath}`);
      const target = new URL(readCanonical(redirect), BECHDEL_ORIGIN);
      if (target.origin !== BECHDEL_ORIGIN || !target.pathname.startsWith(shortPath)) {
        throw new SourceUnavailableError('bechdel', `canônico de ${siteId} aponta para outro endereço`);
      }

      const path = decodeURIComponent(target.pathname);
      const html = target.pathname === shortPath ? redirect : await fetchPage(target.href);
      return { siteId, url: `${BECHDEL_ORIGIN}${encodePath(path)}`, ...readBechdelPage(html) };
    },
  };
}

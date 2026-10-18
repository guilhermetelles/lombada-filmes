import { WikipediaCategoriesResponse } from '../../schemas/sources/wikipedia.js';
import type { AwardItem } from '../../types/awards.js';
import type { AwardsById, Fetch, WikipediaArticle, WikipediaClient } from '../../types/sources.js';
import { DEFAULT_RETRY, fetchJsonWithRetry, type RetryOptions } from '../shared/fetch-json-with-retry.js';
import { WIKIMEDIA_USER_AGENT } from '../wikidata/wikidata-client.js';
import { categoryToAward } from './category-awards.js';

/** API da Wikipedia em inglês. */
const API_URL = 'https://en.wikipedia.org/w/api.php';

/** Artigos por pedido (a API aceita até 50; 20 mantém a resposta pequena). */
const TITLES_PER_REQUEST = 20;

/** Limite de continuações por pedido, para um formato inesperado não virar um laço sem fim. */
const MAX_CONTINUATIONS = 10;

/**
 * Cria o cliente da Wikipedia: prêmios pelas categorias dos artigos em inglês.
 *
 * @param options - O fetch a usar e, nos testes, as novas tentativas sem espera.
 * @returns Cliente de prêmios por artigo.
 */
function createWikipediaClient({
  fetch,
  retry = DEFAULT_RETRY,
}: {
  fetch: Fetch;
  retry?: RetryOptions;
}): WikipediaClient {
  /**
   * Lê as categorias visíveis de até 20 artigos, seguindo as continuações da API.
   *
   * @param titles - Títulos dos artigos, como no sitelink.
   * @returns Categorias por título pedido.
   * @throws {SourceUnavailableError} Se a Wikipedia falhar ou responder fora do formato.
   */
  const categoriesOf = async (titles: string[]): Promise<Map<string, string[]>> => {
    const categories = new Map<string, string[]>();
    let continuation: Record<string, string> = {};
    for (let round = 0; round < MAX_CONTINUATIONS; round++) {
      const params = new URLSearchParams({
        action: 'query',
        prop: 'categories',
        titles: titles.join('|'),
        cllimit: 'max',
        clshow: '!hidden',
        redirects: '1',
        format: 'json',
        formatversion: '2',
        ...continuation,
      });
      const response = await fetchJsonWithRetry(
        fetch,
        'wikipedia',
        `${API_URL}?${params}`,
        WikipediaCategoriesResponse,
        { headers: { accept: 'application/json', 'user-agent': WIKIMEDIA_USER_AGENT } },
        retry,
      );
      const requested = requestedTitles(response);
      for (const page of response.query?.pages ?? []) {
        const title = requested.get(page.title) ?? page.title;
        categories.set(title, [...(categories.get(title) ?? []), ...page.categories.map((category) => category.title)]);
      }
      if (!response.continue) break;
      continuation = Object.fromEntries(Object.entries(response.continue).map(([key, value]) => [key, String(value)]));
    }
    return categories;
  };

  return {
    /**
     * Busca os prêmios de filmes pelas categorias dos artigos: a Framboesa de Ouro (que o Wikidata
     * quase não registra) e as vitórias nas premiações principais, sem ano.
     *
     * @param articles - Filmes e o título do artigo de cada um (sitelink do Wikidata).
     * @returns Prêmios por id do TMDb (ainda com repetições); quem não tem fica fora do mapa.
     * @throws {SourceUnavailableError} Se a Wikipedia falhar ou responder fora do formato.
     */
    async awardsByArticles(articles: WikipediaArticle[]): Promise<AwardsById> {
      const awards: AwardsById = new Map();
      for (let start = 0; start < articles.length; start += TITLES_PER_REQUEST) {
        const chunk = articles.slice(start, start + TITLES_PER_REQUEST);
        const categories = await categoriesOf(chunk.map((article) => article.title));
        for (const { tmdbId, title } of chunk) {
          const items = (categories.get(title) ?? [])
            .map((category) => categoryToAward(category))
            .filter((item): item is AwardItem => item !== null);
          if (items.length > 0) awards.set(tmdbId, items);
        }
      }
      return awards;
    },
  };
}

/**
 * Liga o título final de cada página ao título pedido, desfazendo a normalização e o
 * redirecionamento que a API aplica.
 *
 * @param response - Resposta validada.
 * @returns Título pedido por título final.
 */
function requestedTitles(response: WikipediaCategoriesResponse): Map<string, string> {
  const back = new Map<string, string>();
  for (const change of [...(response.query?.redirects ?? []), ...(response.query?.normalized ?? [])]) {
    back.set(change.to, change.from);
  }
  const requested = new Map<string, string>();
  for (const page of response.query?.pages ?? []) {
    let title = page.title;
    const seen = new Set<string>();
    while (back.has(title) && !seen.has(title)) {
      seen.add(title);
      title = back.get(title) ?? title;
    }
    requested.set(page.title, title);
  }
  return requested;
}

export { createWikipediaClient };

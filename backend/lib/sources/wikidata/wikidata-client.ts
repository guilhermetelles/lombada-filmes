import { WikidataAwardsResponse } from '../../schemas/sources/wikidata.js';
import type { AwardsById, Fetch, WikidataClient } from '../../types/sources.js';
import { DEFAULT_RETRY, fetchJsonWithRetry, type RetryOptions } from '../shared/fetch-json-with-retry.js';
import { toAwardsById, toEnwikiTitles } from './award-rows.js';
import { buildAwardsQuery, type TmdbIdProperty } from './awards-query.js';

/** Serviço SPARQL do Wikidata. */
const SPARQL_URL = 'https://query.wikidata.org/sparql';

/**
 * User-Agent dos pedidos à Wikimedia (Wikidata e Wikipedia), com contato, como a política de uso
 * pede.
 */
export const WIKIMEDIA_USER_AGENT =
  'lombada/1.0 (app pessoal; +https://lombada-lovat.vercel.app; guilhermegts@gmail.com)';

/** Maior lote numa consulta só; acima disso a URL fica longa e a consulta pode passar de 60 s. */
const MAX_BATCH = 50;

/**
 * Cria o cliente do Wikidata: prêmios por id do TMDb, uma consulta SPARQL por lote (lotes acima de
 * 50 viram mais de uma consulta). Responde 429 (pedidos demais)? Espera e tenta de novo.
 *
 * @param options - O fetch a usar e, nos testes, as novas tentativas sem espera.
 * @returns Cliente de prêmios de filmes e de pessoas.
 */
function createWikidataClient({
  fetch,
  retry = DEFAULT_RETRY,
}: {
  fetch: Fetch;
  retry?: RetryOptions;
}): WikidataClient {
  /**
   * Roda a consulta de prêmios de um lote, em pedaços de até 50.
   *
   * @param tmdbIds - Ids do TMDb.
   * @param property - P4947 (filmes) ou P4985 (pessoas).
   * @returns As linhas de todas as consultas.
   * @throws {SourceUnavailableError} Se o Wikidata falhar ou responder fora do formato.
   */
  const queryAwards = async (tmdbIds: number[], property: TmdbIdProperty) => {
    const ids = [...new Set(tmdbIds)];
    const rows = [];
    for (let start = 0; start < ids.length; start += MAX_BATCH) {
      const query = buildAwardsQuery(ids.slice(start, start + MAX_BATCH), property, property === 'P4947');
      const params = new URLSearchParams({ query, format: 'json' });
      const response = await fetchJsonWithRetry(
        fetch,
        'wikidata',
        `${SPARQL_URL}?${params}`,
        WikidataAwardsResponse,
        { headers: { accept: 'application/sparql-results+json', 'user-agent': WIKIMEDIA_USER_AGENT } },
        retry,
      );
      rows.push(...response.results.bindings);
    }
    return rows;
  };

  return {
    /**
     * Busca prêmios e indicações de filmes (P4947), com o artigo de cada um na Wikipedia em inglês.
     *
     * @param tmdbIds - Ids de filme do TMDb.
     * @returns Prêmios (ainda com repetições) e títulos dos artigos, por id do TMDb.
     * @throws {SourceUnavailableError} Se o Wikidata falhar ou responder fora do formato.
     */
    async awardsByTmdbIds(tmdbIds) {
      if (tmdbIds.length === 0) return { awards: new Map(), enwikiTitles: new Map() };
      const rows = await queryAwards(tmdbIds, 'P4947');
      return { awards: toAwardsById(rows), enwikiTitles: toEnwikiTitles(rows) };
    },

    /**
     * Busca prêmios e indicações de pessoas (P4985).
     *
     * @param personIds - Ids de pessoa do TMDb.
     * @returns Prêmios por id de pessoa (ainda com repetições).
     * @throws {SourceUnavailableError} Se o Wikidata falhar ou responder fora do formato.
     */
    async personAwardsByTmdbIds(personIds): Promise<AwardsById> {
      if (personIds.length === 0) return new Map();
      return toAwardsById(await queryAwards(personIds, 'P4985'));
    },
  };
}

export { createWikidataClient };

import { SourceUnavailableError } from '../../errors/app-errors.js';
import type { Fetch, WikidataClient } from '../../types/sources.js';

/**
 * Cria o cliente do Wikidata (consulta SPARQL por lote: P4947/P4985, id do TMDb, com P166 e P1411).
 * Ainda é um esqueleto: a versão real chega na Fase 1 (B1), com o fetch injetado.
 *
 * @param options - O fetch a usar.
 * @returns Cliente de prêmios por id do TMDb.
 */
function createWikidataClient({ fetch }: { fetch: Fetch }): WikidataClient {
  // Guardado para a versão real; o esqueleto não faz pedidos.
  void fetch;
  return {
    /**
     * Busca prêmios e indicações de filmes, em lote.
     *
     * @param _tmdbIds - Ids de filme do TMDb.
     * @returns Prêmios por id do TMDb.
     * @throws {SourceUnavailableError} Sempre, até a versão real.
     */
    async awardsByTmdbIds(_tmdbIds) {
      throw new SourceUnavailableError('wikidata', 'prêmios de filmes não implementado');
    },

    /**
     * Busca prêmios e indicações de pessoas, em lote.
     *
     * @param _personIds - Ids de pessoa do TMDb.
     * @returns Prêmios por id de pessoa do TMDb.
     * @throws {SourceUnavailableError} Sempre, até a versão real.
     */
    async personAwardsByTmdbIds(_personIds) {
      throw new SourceUnavailableError('wikidata', 'prêmios de pessoas não implementado');
    },
  };
}

export { createWikidataClient };

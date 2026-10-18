import { SourceUnavailableError } from '../../errors/app-errors.js';
import type { Fetch, WikipediaClient } from '../../types/sources.js';

/**
 * Cria o cliente da Wikipedia (páginas da Framboesa de Ouro). Ainda é um esqueleto: a versão real
 * chega na Fase 1 (B1), com o fetch injetado.
 *
 * @param options - O fetch a usar.
 * @returns Cliente da Framboesa de Ouro por título e ano.
 */
function createWikipediaClient({ fetch }: { fetch: Fetch }): WikipediaClient {
  // Guardado para a versão real; o esqueleto não faz pedidos.
  void fetch;
  return {
    /**
     * Procura indicações e vitórias na Framboesa de Ouro.
     *
     * @param _movies - Filmes procurados (id do TMDb, título em inglês e ano).
     * @returns Prêmios por id do TMDb.
     * @throws {SourceUnavailableError} Sempre, até a versão real.
     */
    async razzieByTitles(_movies) {
      throw new SourceUnavailableError('wikipedia', 'Framboesa de Ouro não implementado');
    },
  };
}

export { createWikipediaClient };

import { SourceUnavailableError } from '../../errors/app-errors.js';
import type { Fetch, GeminiClient } from '../../types/sources.js';

/**
 * Cria o cliente do Gemini (@google/genai, `store: false`, modelos de GEMINI_MODELS). Ainda é um
 * esqueleto: a versão real chega na Fase 1 (B2). Sem GEMINI_API_KEY, a versão real também deve
 * lançar SourceUnavailableError, para não derrubar as outras rotas.
 *
 * @param options - Chave da API (opcional) e o fetch a usar.
 * @returns Cliente que gera JSON validado.
 */
function createGeminiClient({ apiKey, fetch }: { apiKey: string | undefined; fetch: Fetch }): GeminiClient {
  // Guardados para a versão real; o esqueleto não faz pedidos.
  void apiKey;
  void fetch;
  return {
    /**
     * Gera uma resposta JSON no formato do schema.
     *
     * @param _request - Modelo, instrução de sistema, texto e schema da resposta.
     * @returns A resposta validada pelo schema.
     * @throws {SourceUnavailableError} Sempre, até a versão real.
     */
    async generateJson(_request) {
      throw new SourceUnavailableError('gemini', 'cliente não implementado');
    },
  };
}

export { createGeminiClient };

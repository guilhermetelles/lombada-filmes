import { GoogleGenAI } from '@google/genai';
import { SourceUnavailableError } from '../../errors/app-errors.js';
import type { Fetch, GeminiClient } from '../../types/sources.js';
import { parseSourceData } from '../shared/fetch-json.js';
import { toGeminiJsonSchema } from './gemini-json-schema.js';

/** Tempo máximo de um pedido ao Gemini; acima disso a rota responde 502 em vez de esperar. */
export const GEMINI_TIMEOUT_MS = 30_000;

/**
 * Cria o cliente do Gemini: API de Interações do @google/genai, sempre com `store: false` (nada fica
 * guardado no Google além do pedido), resposta em JSON no formato do schema zod, validada ao voltar.
 * Os modelos vêm de GEMINI_MODELS (versões fixas). Sem nova tentativa automática: cada chamada é
 * um pedido só, que é o que `usage.track('gemini', …)` conta em quem chama.
 *
 * @param options - Chave da API (opcional) e o fetch a usar.
 * @returns Cliente que gera JSON validado.
 */
function createGeminiClient({ apiKey, fetch }: { apiKey: string | undefined; fetch: Fetch }): GeminiClient {
  // Montado só no primeiro pedido, e só se houver chave.
  let sdk: GoogleGenAI | undefined;

  return {
    /**
     * Gera uma resposta JSON no formato do schema.
     *
     * @param request - Modelo, instrução de sistema, texto e schema da resposta.
     * @returns A resposta validada pelo schema.
     * @throws {SourceUnavailableError} Sem GEMINI_API_KEY (sem fazer pedido), se o pedido falhar,
     *   passar do tempo limite, não terminar ou voltar fora do formato.
     */
    async generateJson({ model, system, prompt, schema }) {
      if (!apiKey) throw new SourceUnavailableError('gemini', 'GEMINI_API_KEY não configurada');
      sdk ??= new GoogleGenAI({ apiKey, httpOptions: { fetch, timeout: GEMINI_TIMEOUT_MS } });

      let interaction: Awaited<ReturnType<GoogleGenAI['interactions']['create']>>;
      try {
        interaction = await sdk.interactions.create(
          {
            model,
            input: prompt,
            store: false,
            ...(system ? { system_instruction: system } : {}),
            generation_config: { thinking_level: 'low' },
            response_format: { type: 'text', mime_type: 'application/json', schema: toGeminiJsonSchema(schema) },
          },
          { maxRetries: 0 },
        );
      } catch (cause) {
        throw new SourceUnavailableError('gemini', describeFailure(cause), { cause });
      }

      if (interaction.status !== 'completed') {
        throw new SourceUnavailableError('gemini', `interação terminou como ${interaction.status}`);
      }
      const text = interaction.output_text;
      if (!text) throw new SourceUnavailableError('gemini', 'resposta sem texto');

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch (cause) {
        throw new SourceUnavailableError('gemini', 'resposta não é JSON', { cause });
      }
      return parseSourceData(schema, data, 'gemini');
    },
  };
}

/**
 * Resume o motivo de uma falha do SDK para o log, sem a chave (que vai num cabeçalho, nunca na URL).
 *
 * @param cause - Erro lançado pelo SDK.
 * @returns Status HTTP e mensagem, ou só a mensagem quando não houve resposta (rede, tempo limite).
 */
function describeFailure(cause: unknown): string {
  if (!(cause instanceof Error)) return 'falha desconhecida';
  const status = 'status' in cause && typeof cause.status === 'number' ? `respondeu ${cause.status}: ` : '';
  return `${status}${cause.name}: ${cause.message}`.slice(0, 300);
}

export { createGeminiClient };

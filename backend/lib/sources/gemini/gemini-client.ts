import { GoogleGenAI } from '@google/genai';
import type * as z from 'zod';
import { SourceUnavailableError } from '../../errors/app-errors.js';
import type { Fetch, GeminiClient } from '../../types/sources.js';
import { parseSourceData } from '../shared/fetch-json.js';
import { toGeminiJsonSchema } from './gemini-json-schema.js';

/** Tempo máximo de um pedido ao Gemini; acima disso a rota responde 502 em vez de esperar. */
export const GEMINI_TIMEOUT_MS = 30_000;

/**
 * Cria o cliente do Gemini: API de Interações do @google/genai, sempre com `store: false` (nada fica
 * guardado no Google além do pedido), resposta em JSON no formato do schema zod, validada ao voltar.
 * Os modelos vêm de GEMINI_MODELS (versões fixas, em ordem de preferência): com a cota de um
 * esgotada, o pedido vai ao próximo. Sem nova tentativa no mesmo modelo. Com o medidor de consumo no
 * pedido, cada modelo tem os pedidos, erros e 429 contados em usage/{dia}.geminiModels, e o modelo
 * que já respondeu 429 hoje é pulado direto (se todos já responderam, tenta só o primeiro, para
 * notar quando a cota voltar).
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
    async generateJson({ model, system, prompt, schema, usage }) {
      if (!apiKey) throw new SourceUnavailableError('gemini', 'GEMINI_API_KEY não configurada');
      sdk ??= new GoogleGenAI({ apiKey, httpOptions: { fetch, timeout: GEMINI_TIMEOUT_MS } });
      const client = sdk;
      const models: readonly string[] = typeof model === 'string' ? [model] : model;
      const outOfQuota = usage ? await usage.geminiModelsOutOfQuota() : new Set<string>();
      const available = models.filter((candidate) => !outOfQuota.has(candidate));
      const candidates = available.length > 0 ? available : models.slice(0, 1);

      // Cota diária esgotada (429) ou modelo indisponível (404, 503): tenta o próximo da lista.
      let lastError: SourceUnavailableError | undefined;
      for (const candidate of candidates) {
        usage?.countGeminiModel(candidate, 'calls');
        try {
          return await requestJson(client, { model: candidate, system, prompt, schema });
        } catch (error) {
          usage?.countGeminiModel(candidate, 'errors');
          if (error instanceof SourceUnavailableError && statusOf(error.cause) === 429) {
            usage?.countGeminiModel(candidate, 'quota');
          }
          if (!(error instanceof SourceUnavailableError) || !isFallbackStatus(error.cause)) throw error;
          lastError = error;
        }
      }
      throw lastError ?? new SourceUnavailableError('gemini', 'nenhum modelo configurado');
    },
  };
}

/**
 * Faz um pedido a um modelo e valida o JSON que volta.
 *
 * @param sdk - SDK já montado com a chave.
 * @param request - Modelo, instrução de sistema, texto e schema da resposta.
 * @returns A resposta validada pelo schema.
 * @throws {SourceUnavailableError} Se o pedido falhar, passar do tempo limite, não terminar ou voltar
 *   fora do formato; a causa guarda o erro do SDK (com o status HTTP, quando houve resposta).
 */
async function requestJson<T>(
  sdk: GoogleGenAI,
  {
    model,
    system,
    prompt,
    schema,
  }: { model: string; system?: string | undefined; prompt: string; schema: z.ZodType<T> },
): Promise<T> {
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
    throw new SourceUnavailableError('gemini', `${model}: ${describeFailure(cause)}`, { cause });
  }

  if (interaction.status !== 'completed') {
    throw new SourceUnavailableError('gemini', `${model}: interação terminou como ${interaction.status}`);
  }
  const text = interaction.output_text;
  if (!text) throw new SourceUnavailableError('gemini', `${model}: resposta sem texto`);

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    throw new SourceUnavailableError('gemini', `${model}: resposta não é JSON`, { cause });
  }
  return parseSourceData(schema, data, 'gemini');
}

/**
 * Diz se a falha do SDK pede outro modelo: cota esgotada (429) ou modelo fora do ar (404, 503).
 *
 * @param cause - Causa guardada no SourceUnavailableError.
 * @returns true para esses status.
 */
function isFallbackStatus(cause: unknown): boolean {
  const status = statusOf(cause);
  return status === 429 || status === 404 || status === 503;
}

/**
 * Status HTTP guardado no erro do SDK, quando houve resposta.
 *
 * @param cause - Causa guardada no SourceUnavailableError.
 * @returns O status, ou undefined.
 */
function statusOf(cause: unknown): unknown {
  return cause instanceof Error && 'status' in cause ? cause.status : undefined;
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

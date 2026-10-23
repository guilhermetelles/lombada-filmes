import { GoogleGenAI } from '@google/genai';
import type * as z from 'zod';
import { SourceUnavailableError } from '../../errors/app-errors.js';
import type { Fetch, GeminiClient } from '../../types/sources.js';
import { requestGroqJson } from '../groq/groq-request.js';
import { parseSourceData } from '../shared/fetch-json.js';
import { toGeminiJsonSchema } from './gemini-json-schema.js';
import { type ModelProvider, modelProvider } from './gemini-models.js';
import { quotaRetryAt } from './quota-retry.js';

/** Tempo máximo de um pedido a um modelo, quando quem pede não diz outro. */
export const GEMINI_TIMEOUT_MS = 30_000;

/** Quanto um modelo fora do ar (5xx, 404, tempo limite, rede) fica pulado antes de ser tentado de novo. */
export const GEMINI_UNAVAILABLE_REST_MS = 5 * 60_000;

/** Tempo mínimo que ainda vale gastar num modelo; com menos que isso do prazo total, o pedido para. */
const MIN_ATTEMPT_MS = 2_000;

/** Status HTTP de modelo fora do ar, que pedem o próximo da lista. */
const UNAVAILABLE_STATUSES = new Set([404, 500, 502, 503, 504]);

/** Erros do SDK sem resposta HTTP: tempo limite ou falha de rede. */
const CONNECTION_ERRORS = new Set(['APIConnectionTimeoutError', 'APIConnectionError']);

/**
 * Cria o cliente dos modelos de texto. Os do Gemini vão pela API de Interações do @google/genai,
 * sempre com `store: false` (nada fica guardado no Google além do pedido); os da Groq, pela API de
 * chat dela (requestGroqJson). Em ambos a resposta vem em JSON no formato do schema zod, validada ao
 * voltar. Modelo de um provedor sem chave fica de fora da lista. Os modelos vêm de GEMINI_MODELS
 * (versões fixas, em ordem de preferência): com a cota de um esgotada (429), ele fora do ar (5xx,
 * 404, tempo limite, rede) ou a resposta fora do formato, o pedido vai ao próximo. Sem nova
 * tentativa no mesmo modelo. Cada tentativa conta como pedido (e erro, se falhar) da fonte do
 * provedor, `gemini` ou `groq`, em usage/{dia}. Cada modelo tem `timeoutMs` para responder, e `budgetMs` limita o pedido
 * inteiro: o modelo seguinte só recebe o que sobrou do prazo. Com o medidor de consumo no pedido,
 * cada modelo tem os pedidos, erros e 429 contados em usage/{dia}.geminiModels, e o modelo que
 * falhou fica pulado: no 429, até quando o próprio erro diz que a cota volta (quotaRetryAt); fora do
 * ar, por GEMINI_UNAVAILABLE_REST_MS. Se todos estão no prazo, tenta só o primeiro, para notar
 * quando ele voltar.
 *
 * @param options - Chaves do Gemini e da Groq (opcionais), o fetch a usar e o relógio.
 * @returns Cliente que gera JSON validado.
 */
function createGeminiClient({
  apiKey,
  groqApiKey,
  fetch,
  now = () => new Date(),
}: {
  apiKey: string | undefined;
  groqApiKey?: string | undefined;
  fetch: Fetch;
  now?: () => Date;
}): GeminiClient {
  const keys: Record<ModelProvider, string | undefined> = { gemini: apiKey, groq: groqApiKey };
  // Montado só no primeiro pedido, e só se houver chave.
  let sdk: GoogleGenAI | undefined;

  return {
    /**
     * Gera uma resposta JSON no formato do schema.
     *
     * @param request - Modelo, instrução de sistema, texto e schema da resposta.
     * @returns A resposta validada pelo schema.
     * @throws {SourceUnavailableError} Sem chave para nenhum dos modelos (sem fazer pedido), ou se o
     *   último modelo tentado falhar, passar do tempo limite, não terminar ou voltar fora do formato.
     */
    async generateJson({ model, purpose, system, prompt, schema, usage, timeoutMs = GEMINI_TIMEOUT_MS, budgetMs }) {
      usage?.countGeminiPurpose(purpose, 'requests');
      try {
        const reply = await tryModels();
        usage?.countGeminiPurpose(purpose, 'answered');
        return reply;
      } catch (error) {
        usage?.countGeminiPurpose(purpose, 'failed');
        throw error;
      }

      /**
       * Tenta os modelos na ordem até um responder, dentro do prazo total.
       *
       * @returns A resposta validada pelo schema.
       * @throws {SourceUnavailableError} Sem chave, ou se o último modelo tentado falhar.
       */
      async function tryModels() {
        const listed: readonly string[] = typeof model === 'string' ? [model] : model;
        const models = listed.filter((candidate) => keys[modelProvider(candidate)] !== undefined);
        if (models.length === 0)
          throw new SourceUnavailableError('gemini', 'nenhuma chave configurada para os modelos');
        const resting = usage ? await usage.geminiModelsToSkip() : new Set<string>();
        const available = models.filter((candidate) => !resting.has(candidate));
        const candidates = available.length > 0 ? available : models.slice(0, 1);
        const deadline = budgetMs === undefined ? undefined : Date.now() + budgetMs;

        // Cota esgotada (429) ou modelo fora do ar: tenta o próximo da lista, dentro do prazo total.
        let lastError: SourceUnavailableError | undefined;
        for (const candidate of candidates) {
          const remaining = deadline === undefined ? Number.POSITIVE_INFINITY : deadline - Date.now();
          if (lastError && remaining < MIN_ATTEMPT_MS) break;
          const provider = modelProvider(candidate);
          usage?.count(provider, 'calls');
          usage?.countGeminiModel(candidate, 'calls');
          const startedAt = Date.now();
          try {
            const reply = await requestModel(provider, {
              model: candidate,
              system,
              prompt,
              schema,
              timeoutMs: Math.min(timeoutMs, Math.max(MIN_ATTEMPT_MS, remaining)),
            });
            usage?.countGeminiModel(candidate, 'answered');
            usage?.countGeminiModel(candidate, 'latencyMs', Date.now() - startedAt);
            return reply;
          } catch (error) {
            usage?.count(provider, 'errors');
            usage?.countGeminiModel(candidate, 'errors');
            if (!(error instanceof SourceUnavailableError)) throw error;
            const kind = failureKind(error.cause);
            if (!kind) throw error;
            usage?.countGeminiModel(candidate, kind);
            // Resposta fora do formato não tira o modelo da fila: o próximo pedido pode vir certo.
            if (kind === 'quota') {
              usage?.skipGeminiModel(candidate, quotaRetryAt(error.cause, now()), 'quota');
            } else if (kind !== 'format') {
              usage?.skipGeminiModel(candidate, new Date(now().getTime() + GEMINI_UNAVAILABLE_REST_MS), 'unavailable');
            }
            lastError = error;
          }
        }
        throw lastError ?? new SourceUnavailableError('gemini', 'nenhum modelo configurado');
      }
    },
  };

  /**
   * Faz o pedido a um modelo pela API do provedor dele.
   *
   * @param provider - Gemini ou Groq.
   * @param request - Modelo, instrução de sistema, texto, schema da resposta e tempo máximo.
   * @returns A resposta validada pelo schema.
   * @throws {SourceUnavailableError} Se o pedido falhar (ver requestJson e requestGroqJson).
   */
  async function requestModel<T>(
    provider: ModelProvider,
    request: { model: string; system?: string | undefined; prompt: string; schema: z.ZodType<T>; timeoutMs: number },
  ): Promise<T> {
    const key = keys[provider];
    if (key === undefined) throw new SourceUnavailableError(provider, 'sem chave');
    if (provider === 'groq') return requestGroqJson(fetch, key, request);
    sdk ??= new GoogleGenAI({ apiKey: key, httpOptions: { fetch, timeout: GEMINI_TIMEOUT_MS } });
    return requestJson(sdk, request);
  }
}

/**
 * Faz um pedido a um modelo e valida o JSON que volta.
 *
 * @param sdk - SDK já montado com a chave.
 * @param request - Modelo, instrução de sistema, texto, schema da resposta e tempo máximo.
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
    timeoutMs,
  }: { model: string; system?: string | undefined; prompt: string; schema: z.ZodType<T>; timeoutMs: number },
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
      { maxRetries: 0, timeout: timeoutMs },
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
 * Classifica a falha de um modelo: 429 é cota; 5xx e 404 (versão retirada), fora do ar; erro do SDK
 * sem resposta, tempo limite ou rede; sem status nem erro de conexão, resposta fora do formato
 * (JSON inválido, schema, interação que não terminou). Outro status HTTP (como 400) não tem tipo.
 * Todos os tipos pedem o próximo modelo.
 *
 * @param cause - Causa guardada no SourceUnavailableError.
 * @returns O tipo, ou undefined para os erros que não pedem outro modelo nem têm contador próprio.
 */
function failureKind(cause: unknown): 'quota' | 'unavailable' | 'timeout' | 'format' | undefined {
  const status = statusOf(cause);
  if (status === 429) return 'quota';
  if (typeof status === 'number') return UNAVAILABLE_STATUSES.has(status) ? 'unavailable' : undefined;
  if (cause instanceof Error && CONNECTION_ERRORS.has(cause.name)) return 'timeout';
  return 'format';
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

import { GoogleGenAI } from '@google/genai';
import type * as z from 'zod';
import { SourceUnavailableError } from '../../errors/app-errors.js';
import type { Fetch, GeminiClient } from '../../types/sources.js';
import { parseSourceData } from '../shared/fetch-json.js';
import { toGeminiJsonSchema } from './gemini-json-schema.js';
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
 * Cria o cliente do Gemini: API de Interações do @google/genai, sempre com `store: false` (nada fica
 * guardado no Google além do pedido), resposta em JSON no formato do schema zod, validada ao voltar.
 * Os modelos vêm de GEMINI_MODELS (versões fixas, em ordem de preferência): com a cota de um
 * esgotada (429) ou ele fora do ar (5xx, 404, tempo limite, rede), o pedido vai ao próximo. Sem nova
 * tentativa no mesmo modelo. Cada modelo tem `timeoutMs` para responder, e `budgetMs` limita o pedido
 * inteiro: o modelo seguinte só recebe o que sobrou do prazo. Com o medidor de consumo no pedido,
 * cada modelo tem os pedidos, erros e 429 contados em usage/{dia}.geminiModels, e o modelo que
 * falhou fica pulado: no 429, até quando o próprio erro diz que a cota volta (quotaRetryAt); fora do
 * ar, por GEMINI_UNAVAILABLE_REST_MS. Se todos estão no prazo, tenta só o primeiro, para notar
 * quando ele voltar.
 *
 * @param options - Chave da API (opcional), o fetch a usar e o relógio.
 * @returns Cliente que gera JSON validado.
 */
function createGeminiClient({
  apiKey,
  fetch,
  now = () => new Date(),
}: {
  apiKey: string | undefined;
  fetch: Fetch;
  now?: () => Date;
}): GeminiClient {
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
        if (!apiKey) throw new SourceUnavailableError('gemini', 'GEMINI_API_KEY não configurada');
        sdk ??= new GoogleGenAI({ apiKey, httpOptions: { fetch, timeout: GEMINI_TIMEOUT_MS } });
        const client = sdk;
        const models: readonly string[] = typeof model === 'string' ? [model] : model;
        const resting = usage ? await usage.geminiModelsToSkip() : new Set<string>();
        const available = models.filter((candidate) => !resting.has(candidate));
        const candidates = available.length > 0 ? available : models.slice(0, 1);
        const deadline = budgetMs === undefined ? undefined : Date.now() + budgetMs;

        // Cota esgotada (429) ou modelo fora do ar: tenta o próximo da lista, dentro do prazo total.
        let lastError: SourceUnavailableError | undefined;
        for (const candidate of candidates) {
          const remaining = deadline === undefined ? Number.POSITIVE_INFINITY : deadline - Date.now();
          if (lastError && remaining < MIN_ATTEMPT_MS) break;
          usage?.countGeminiModel(candidate, 'calls');
          const startedAt = Date.now();
          try {
            const reply = await requestJson(client, {
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
            usage?.countGeminiModel(candidate, 'errors');
            if (!(error instanceof SourceUnavailableError)) throw error;
            const kind = failureKind(error.cause);
            if (kind) usage?.countGeminiModel(candidate, kind);
            if (kind === 'quota') {
              usage?.skipGeminiModel(candidate, quotaRetryAt(error.cause, now()), 'quota');
            } else if (kind === 'unavailable' || kind === 'timeout') {
              usage?.skipGeminiModel(candidate, new Date(now().getTime() + GEMINI_UNAVAILABLE_REST_MS), 'unavailable');
            } else {
              throw error;
            }
            lastError = error;
          }
        }
        throw lastError ?? new SourceUnavailableError('gemini', 'nenhum modelo configurado');
      }
    },
  };
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

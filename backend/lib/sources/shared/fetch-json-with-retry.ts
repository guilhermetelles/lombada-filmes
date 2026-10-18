import type * as z from 'zod';
import { NotFoundError, SourceUnavailableError } from '../../errors/app-errors.js';
import type { Fetch, SourceName } from '../../types/sources.js';
import { parseSourceData } from './fetch-json.js';

/** Espera entre tentativas: a real usa setTimeout; os testes passam uma que não espera. */
export type Wait = (ms: number) => Promise<void>;

/** Quantas vezes tentar de novo depois de um 429, e a maior espera aceita entre tentativas. */
export type RetryOptions = { retries: number; maxDelayMs: number; wait: Wait };

/** Espera de verdade, com setTimeout. */
export const sleep: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Padrão das fontes da Wikimedia: duas novas tentativas, esperando no máximo 10 s cada. */
export const DEFAULT_RETRY: RetryOptions = { retries: 2, maxDelayMs: 10_000, wait: sleep };

/**
 * Quanto esperar antes de tentar de novo: o Retry-After da resposta (em segundos), ou 2 s, 4 s…
 * quando ele falta, sempre limitado a `maxDelayMs`.
 *
 * @param response - Resposta 429.
 * @param attempt - Tentativa que falhou (0 na primeira).
 * @param maxDelayMs - Maior espera aceita.
 * @returns A espera em milissegundos.
 */
function retryDelayMs(response: Response, attempt: number, maxDelayMs: number): number {
  const retryAfter = Number(response.headers.get('retry-after'));
  const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
  return Math.min(delay, maxDelayMs);
}

/**
 * Faz um pedido que devolve JSON e, se a fonte responder 429 (pedidos demais), espera e tenta de
 * novo. A URL fica fora das mensagens de erro, como em fetchJson.
 *
 * @param fetch - fetch injetado.
 * @param source - Fonte, para as mensagens.
 * @param url - Endereço completo.
 * @param schema - Formato esperado da resposta (lib/schemas/sources/).
 * @param init - Opções do pedido, como cabeçalhos.
 * @param retry - Novas tentativas, espera máxima e a função de espera.
 * @returns A resposta validada e convertida pelo schema.
 * @throws {NotFoundError} Se a fonte responder 404.
 * @throws {SourceUnavailableError} Se a rede falhar, a fonte responder outro erro (ou 429 depois das
 *   tentativas), a resposta não for JSON ou estiver fora do formato.
 */
async function fetchJsonWithRetry<Schema extends z.ZodType>(
  fetch: Fetch,
  source: SourceName,
  url: string,
  schema: Schema,
  init: RequestInit,
  retry: RetryOptions = DEFAULT_RETRY,
): Promise<z.output<Schema>> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (cause) {
      throw new SourceUnavailableError(source, 'falha de rede', { cause });
    }

    if (response.status === 429 && attempt < retry.retries) {
      await retry.wait(retryDelayMs(response, attempt, retry.maxDelayMs));
      continue;
    }
    if (response.status === 404) throw new NotFoundError(`${source}: não encontrado`);
    if (!response.ok) throw new SourceUnavailableError(source, `respondeu ${response.status}`);

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new SourceUnavailableError(source, 'resposta não é JSON', { cause });
    }
    return parseSourceData(schema, body, source);
  }
}

export { fetchJsonWithRetry };

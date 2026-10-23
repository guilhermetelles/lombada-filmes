import type * as z from 'zod';
import { SourceUnavailableError } from '../../errors/app-errors.js';
import { GroqChatCompletionSchema, GroqErrorBodySchema } from '../../schemas/sources/groq.js';
import type { Fetch } from '../../types/sources.js';
import { parseSourceData } from '../shared/fetch-json.js';
import { toGroqJsonSchema } from './groq-json-schema.js';

/** Endpoint de chat da Groq, no formato da OpenAI. */
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Resposta de erro da Groq, com o status, os cabeçalhos (o `retry-after` do 429) e o corpo, nos
 * mesmos campos do erro do SDK do Gemini, para o cliente de modelos tratar os dois igual.
 */
export class GroqHttpError extends Error {
  /**
   * @param status - Status HTTP.
   * @param headers - Cabeçalhos da resposta.
   * @param error - Corpo do erro, quando veio JSON.
   */
  constructor(
    readonly status: number,
    readonly headers: Headers,
    readonly error: unknown,
  ) {
    super(`respondeu ${status}`);
    this.name = 'GroqHttpError';
  }
}

/**
 * Pede a um modelo da Groq uma resposta JSON no formato do schema e a valida. No modo strict a
 * Groq restringe a geração ao schema, então a resposta sempre segue o formato pedido. Os modelos
 * gpt-oss pensam pouco (`reasoning_effort: low`, como o Gemini com `thinking_level: low`); o Qwen
 * 3.8 já vem sem raciocínio por padrão. A Groq não guarda os pedidos por padrão.
 *
 * @param fetch - fetch injetado.
 * @param apiKey - Chave da Groq.
 * @param request - Modelo, instrução de sistema, texto, schema da resposta e tempo máximo.
 * @returns A resposta validada pelo schema.
 * @throws {SourceUnavailableError} Se o pedido falhar, passar do tempo, voltar fora do formato ou
 *   com erro; a causa tem o status HTTP quando houve resposta, e o nome `APIConnectionTimeoutError`
 *   ou `APIConnectionError` (os do SDK do Gemini) quando não houve.
 */
async function requestGroqJson<T>(
  fetch: Fetch,
  apiKey: string,
  {
    model,
    system,
    prompt,
    schema,
    timeoutMs,
  }: { model: string; system?: string | undefined; prompt: string; schema: z.ZodType<T>; timeoutMs: number },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
        ...(model.startsWith('openai/') ? { reasoning_effort: 'low' } : {}),
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'resposta', strict: true, schema: toGroqJsonSchema(schema) },
        },
      }),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError');
    const connection = new Error(timedOut ? 'tempo limite' : 'falha de rede', { cause });
    connection.name = timedOut ? 'APIConnectionTimeoutError' : 'APIConnectionError';
    throw new SourceUnavailableError('groq', `${model}: ${connection.message}`, { cause: connection });
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = GroqErrorBodySchema.safeParse(body);
    const detail = error.success ? (error.data.error.message ?? '').slice(0, 200) : '';
    throw new SourceUnavailableError('groq', `${model}: respondeu ${response.status}: ${detail}`, {
      cause: new GroqHttpError(response.status, response.headers, body),
    });
  }

  const completion = parseSourceData(GroqChatCompletionSchema, body, 'groq');
  const text = completion.choices[0]?.message.content;
  if (!text) throw new SourceUnavailableError('groq', `${model}: resposta sem texto`);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    throw new SourceUnavailableError('groq', `${model}: resposta não é JSON`, { cause });
  }
  return parseSourceData(schema, dropNulls(data), 'groq');
}

/**
 * Tira os campos null: no modo strict os opcionais voltam como null, e o zod espera ausentes.
 *
 * @param value - JSON da resposta.
 * @returns O mesmo JSON sem os campos null.
 */
function dropNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropNulls);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => (item === null ? [] : [[key, dropNulls(item)]])),
  );
}

export { requestGroqJson };

import * as z from 'zod';
import { NotFoundError, SourceUnavailableError } from '../../errors/app-errors.js';
import type { Fetch, SourceName } from '../../types/sources.js';

/**
 * Faz um pedido a uma fonte externa. A URL fica fora das mensagens de erro porque pode levar a
 * chave da API.
 *
 * @param fetch - fetch injetado (o global em produção, um falso nos testes).
 * @param source - Fonte, para as mensagens e o consumo.
 * @param url - Endereço completo.
 * @param init - Opções do pedido, como cabeçalhos.
 * @returns A resposta, já conferida como 2xx.
 * @throws {NotFoundError} Se a fonte responder 404.
 * @throws {SourceUnavailableError} Se a rede falhar ou a fonte responder outro status de erro.
 */
export async function fetchFromSource(
  fetch: Fetch,
  source: SourceName,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw new SourceUnavailableError(source, 'falha de rede', { cause });
  }

  if (response.status === 404) throw new NotFoundError(`${source}: não encontrado`);
  if (!response.ok) throw new SourceUnavailableError(source, `respondeu ${response.status}`);
  return response;
}

/**
 * Faz um pedido que devolve JSON e confere a resposta contra o formato esperado.
 *
 * @param fetch - fetch injetado.
 * @param source - Fonte, para as mensagens e o consumo.
 * @param url - Endereço completo.
 * @param schema - Formato esperado da resposta (lib/schemas/sources/).
 * @param init - Opções do pedido, como cabeçalhos.
 * @returns A resposta validada e convertida pelo schema.
 * @throws {NotFoundError} Se a fonte responder 404.
 * @throws {SourceUnavailableError} Se o pedido falhar, a resposta não for JSON ou estiver fora do formato.
 */
export async function fetchJson<Schema extends z.ZodType>(
  fetch: Fetch,
  source: SourceName,
  url: string,
  schema: Schema,
  init?: RequestInit,
): Promise<z.output<Schema>> {
  const response = await fetchFromSource(fetch, source, url, init);

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new SourceUnavailableError(source, 'resposta não é JSON', { cause });
  }
  return parseSourceData(schema, body, source);
}

/**
 * Confere dados de uma fonte contra o formato esperado. Se a fonte mudar o formato, falha aqui com
 * o motivo, em vez de gravar dado errado no banco.
 *
 * @param schema - Formato esperado.
 * @param data - Dados recebidos.
 * @param source - Fonte, para a mensagem de erro.
 * @returns Os dados validados e convertidos pelo schema.
 * @throws {SourceUnavailableError} Se os dados estiverem fora do formato.
 */
export function parseSourceData<Schema extends z.ZodType>(
  schema: Schema,
  data: unknown,
  source: SourceName,
): z.output<Schema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new SourceUnavailableError(source, `resposta fora do formato esperado:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

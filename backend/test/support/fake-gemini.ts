import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import type { GeminiClient, GeminiRequest } from '../../lib/types/sources.js';

/** O Gemini falso e o que ele registra. */
export type FakeGemini = {
  client: GeminiClient;
  /** Pedidos recebidos, na ordem (sem o schema e o medidor, para comparar com deepEqual). */
  requests: Omit<GeminiRequest<unknown>, 'schema' | 'usage'>[];
  /** Respostas preparadas pelo teste, consumidas na ordem; cada uma passa pelo schema do pedido. */
  replies: unknown[];
};

/**
 * Cria um Gemini falso: cada pedido consome a próxima resposta de `replies`, validada pelo schema
 * do pedido. Sem resposta preparada, falha como fonte indisponível (igual à falta de chave).
 *
 * @returns O cliente, os pedidos recebidos e a fila de respostas.
 */
function createFakeGemini(): FakeGemini {
  const requests: FakeGemini['requests'] = [];
  const replies: unknown[] = [];

  const client: GeminiClient = {
    async generateJson({ schema, usage: _usage, ...request }) {
      requests.push(request);
      if (replies.length === 0) throw new SourceUnavailableError('gemini', 'sem resposta preparada no teste');
      const result = schema.safeParse(replies.shift());
      if (!result.success) throw new SourceUnavailableError('gemini', 'resposta preparada fora do formato');
      return result.data;
    },
  };

  return { client, requests, replies };
}

export { createFakeGemini };

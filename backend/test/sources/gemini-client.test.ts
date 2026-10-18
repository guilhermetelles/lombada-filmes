import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import * as z from 'zod';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { InterpretResultSchema } from '../../lib/schemas/discover.js';
import { createGeminiClient } from '../../lib/sources/gemini/gemini-client.js';
import { GEMINI_MODELS } from '../../lib/sources/gemini/gemini-models.js';
import type { Fetch } from '../../lib/types/sources.js';

/** Resposta real da API de Interações (gemini-3.8-flash, 2026-10-18) à frase "comédia curta dos anos 90 na Netflix". */
const recorded = readFileSync(new URL('../fixtures/gemini-interpret.json', import.meta.url), 'utf8');

/** Um pedido recebido pelo fetch falso. */
type SeenRequest = { url: string; headers: Headers; body: Record<string, unknown> };

/**
 * Fetch falso que registra os pedidos e responde sempre o mesmo.
 *
 * @param body - Corpo da resposta.
 * @param status - Status HTTP.
 * @returns O fetch e os pedidos vistos.
 */
function geminiFetch(body: string, status = 200): { fetch: Fetch; seen: SeenRequest[] } {
  const seen: SeenRequest[] = [];
  const fetch: Fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    seen.push({ url: request.url, headers: request.headers, body: JSON.parse(await request.text()) });
    return new Response(body, { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, seen };
}

const interpretRequest = {
  model: GEMINI_MODELS.interpret,
  system: 'instrução de teste',
  prompt: 'comédia curta dos anos 90 na Netflix',
  schema: InterpretResultSchema,
};

describe('createGeminiClient', () => {
  test('manda store: false, o modelo fixo, a instrução e o JSON Schema, e valida a resposta gravada', async () => {
    const { fetch, seen } = geminiFetch(recorded);
    const result = await createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson(interpretRequest);

    assert.deepEqual(result, {
      filters: { mood: ['leve'], dur: ['ate90'], dec: ['1990'], genre: ['Comédia'], svc: ['Netflix'] },
      explanation: 'Comédias leves e curtas dos anos 1990 na Netflix.',
    });
    assert.equal(seen.length, 1);
    const [request] = seen;
    assert.equal(request?.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(request?.headers.get('x-goog-api-key'), 'chave-de-teste');
    assert.equal(request?.body.store, false);
    assert.equal(request?.body.model, 'gemini-3.8-flash');
    assert.equal(request?.body.input, 'comédia curta dos anos 90 na Netflix');
    assert.equal(request?.body.system_instruction, 'instrução de teste');
    const format = request?.body.response_format as { mime_type: string; schema: Record<string, unknown> };
    assert.equal(format.mime_type, 'application/json');
    assert.equal(format.schema.$schema, undefined);
    assert.deepEqual(format.schema.required, ['filters', 'explanation']);
  });

  test('sem chave: SourceUnavailableError sem fazer pedido', async () => {
    const { fetch, seen } = geminiFetch(recorded);
    await assert.rejects(
      createGeminiClient({ apiKey: undefined, fetch }).generateJson(interpretRequest),
      (error) => error instanceof SourceUnavailableError && error.source === 'gemini',
    );
    assert.equal(seen.length, 0);
  });

  test('erro da API (429) vira SourceUnavailableError, sem nova tentativa', async () => {
    const { fetch, seen } = geminiFetch('{"error":{"code":429,"message":"quota"}}', 429);
    await assert.rejects(
      createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson(interpretRequest),
      (error) => error instanceof SourceUnavailableError && /429/.test(error.message),
    );
    assert.equal(seen.length, 1);
  });

  test('resposta fora do schema vira SourceUnavailableError', async () => {
    const { fetch } = geminiFetch(recorded);
    const strict = z.object({ outraCoisa: z.string() });
    await assert.rejects(
      createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson({ ...interpretRequest, schema: strict }),
      (error) => error instanceof SourceUnavailableError && /fora do formato/.test(error.message),
    );
  });

  test('texto que não é JSON vira SourceUnavailableError', async () => {
    const notJson = JSON.stringify({
      status: 'completed',
      steps: [{ type: 'model_output', content: [{ type: 'text', text: 'não sei' }] }],
    });
    const { fetch } = geminiFetch(notJson);
    await assert.rejects(
      createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson(interpretRequest),
      (error) => error instanceof SourceUnavailableError && /não é JSON/.test(error.message),
    );
  });

  test('interação que não terminou vira SourceUnavailableError', async () => {
    const { fetch } = geminiFetch(JSON.stringify({ status: 'incomplete', steps: [] }));
    await assert.rejects(
      createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson(interpretRequest),
      (error) => error instanceof SourceUnavailableError && /incomplete/.test(error.message),
    );
  });
});

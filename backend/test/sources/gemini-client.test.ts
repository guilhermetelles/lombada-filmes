import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import * as z from 'zod';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { InterpretReplySchema } from '../../lib/schemas/discover.js';
import { createGeminiClient, GEMINI_UNAVAILABLE_REST_MS } from '../../lib/sources/gemini/gemini-client.js';
import { GEMINI_MODELS } from '../../lib/sources/gemini/gemini-models.js';
import type { Fetch } from '../../lib/types/sources.js';
import { GEMINI_QUOTA_DOC, UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';

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

/**
 * Fetch falso que responde por modelo: um status com erro, "hang" (fica sem responder até o SDK
 * desistir), "network" (falha de rede) ou, sem entrada, a resposta gravada.
 *
 * @param byModel - O que cada modelo faz.
 * @returns O fetch e os modelos pedidos, na ordem.
 */
function modelFetch(byModel: Record<string, number | 'hang' | 'network'>): { fetch: Fetch; seen: string[] } {
  const seen: string[] = [];
  const fetch: Fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const model = String(JSON.parse(await request.text()).model);
    seen.push(model);
    const behavior = byModel[model];
    if (behavior === 'network') throw new TypeError('fetch failed');
    if (behavior === 'hang') {
      const signal = init?.signal ?? request.signal;
      return new Promise<Response>((_, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason));
      });
    }
    if (behavior === undefined) return new Response(recorded, { headers: { 'content-type': 'application/json' } });
    return new Response(`{"error":{"code":${behavior},"message":"falha ${behavior}"}}`, {
      status: behavior,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, seen };
}

const interpretRequest = {
  model: GEMINI_MODELS.interpret,
  system: 'instrução de teste',
  prompt: 'comédia curta dos anos 90 na Netflix',
  schema: InterpretReplySchema,
};

describe('createGeminiClient', () => {
  test('manda store: false, o modelo fixo, a instrução e o JSON Schema, e valida a resposta gravada', async () => {
    const { fetch, seen } = geminiFetch(recorded);
    const result = await createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson(interpretRequest);

    assert.deepEqual(result, {
      filters: { mood: ['leve'], dur: ['ate90'], dec: ['1990'], genre: ['Comédia'], svc: ['Netflix'] },
      explanation: 'Comédias leves e curtas dos anos 1990 na Netflix.',
      keywords: [],
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
    assert.deepEqual(format.schema.required, ['filters', 'explanation', 'keywords']);
  });

  test('sem chave: SourceUnavailableError sem fazer pedido', async () => {
    const { fetch, seen } = geminiFetch(recorded);
    await assert.rejects(
      createGeminiClient({ apiKey: undefined, fetch }).generateJson(interpretRequest),
      (error) => error instanceof SourceUnavailableError && error.source === 'gemini',
    );
    assert.equal(seen.length, 0);
  });

  test('cota esgotada (429) em todos os modelos: tenta cada um uma vez e vira SourceUnavailableError', async () => {
    const { fetch, seen } = geminiFetch('{"error":{"code":429,"message":"quota"}}', 429);
    await assert.rejects(
      createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson(interpretRequest),
      (error) => error instanceof SourceUnavailableError && /429/.test(error.message),
    );
    assert.deepEqual(
      seen.map((request) => request.body.model),
      [...GEMINI_MODELS.interpret],
    );
  });

  test('cota esgotada no primeiro modelo: o pedido vai ao próximo da lista', async () => {
    const seen: string[] = [];
    const fetch: Fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const model = String(JSON.parse(await request.text()).model);
      seen.push(model);
      const quota = model === GEMINI_MODELS.interpret[0];
      return new Response(quota ? '{"error":{"code":429,"message":"quota"}}' : recorded, {
        status: quota ? 429 : 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const result = await createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson(interpretRequest);
    assert.equal(result.explanation, 'Comédias leves e curtas dos anos 1990 na Netflix.');
    assert.deepEqual(seen, GEMINI_MODELS.interpret.slice(0, 2));
  });

  test('um modelo só (texto): 429 não tenta outro', async () => {
    const { fetch, seen } = geminiFetch('{"error":{"code":429,"message":"quota"}}', 429);
    await assert.rejects(
      createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson({ ...interpretRequest, model: 'gemini-x' }),
      SourceUnavailableError,
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

  test('com o medidor: conta por modelo, marca o 429 e o próximo pedido pula o modelo sem cota', async () => {
    const seen: string[] = [];
    const fetch: Fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const model = String(JSON.parse(await request.text()).model);
      seen.push(model);
      const quota = model === GEMINI_MODELS.interpret[0];
      return new Response(quota ? '{"error":{"code":429,"message":"quota"}}' : recorded, {
        status: quota ? 429 : 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = createGeminiClient({ apiKey: 'chave-de-teste', fetch });
    const usage = new UsageMeter();

    await client.generateJson({ ...interpretRequest, usage });
    await client.generateJson({ ...interpretRequest, usage });

    const [first, second] = GEMINI_MODELS.interpret;
    assert.deepEqual(seen, [first, second, second]);
    assert.deepEqual(usage.geminiQuotaHits(), [first]);
  });

  test('o 429 pula o modelo até quando o erro diz que a cota volta', async () => {
    const clock = new Date();
    const body = JSON.stringify({
      error: {
        code: 429,
        message: 'Rate limit exceeded for model gemini-3.8-flash (limit: 20 requests per day on Free Tier).',
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '6711s' }],
      },
    });
    const fetch: Fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const model = String(JSON.parse(await request.text()).model);
      return new Response(model === GEMINI_MODELS.interpret[0] ? body : recorded, {
        status: model === GEMINI_MODELS.interpret[0] ? 429 : 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const { db } = createTestDependencies(fakeSources().fetch);
    await resetEmulators();
    const usage = new UsageMeter({ db, now: () => clock });

    await createGeminiClient({ apiKey: 'chave-de-teste', fetch, now: () => clock }).generateJson({
      ...interpretRequest,
      usage,
    });
    await usage.save(db, clock);

    const stored = (await db.doc(GEMINI_QUOTA_DOC).get()).get('skipUntil');
    assert.deepEqual(Object.keys(stored), [GEMINI_MODELS.interpret[0]]);
    assert.equal(stored[GEMINI_MODELS.interpret[0]].toMillis(), clock.getTime() + 6711_000);
  });

  test('todos os modelos no prazo: tenta só o primeiro', async () => {
    const { fetch, seen } = geminiFetch('{"error":{"code":429,"message":"quota"}}', 429);
    const usage = new UsageMeter();
    const later = new Date(Date.now() + 60_000);
    for (const model of GEMINI_MODELS.interpret) usage.skipGeminiModel(model, later);

    await assert.rejects(
      createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson({ ...interpretRequest, usage }),
      SourceUnavailableError,
    );
    assert.deepEqual(
      seen.map((request) => request.body.model),
      [GEMINI_MODELS.interpret[0]],
    );
  });

  test('modelo fora do ar (503): vai ao próximo e fica pulado por alguns minutos', async () => {
    const [first, second] = GEMINI_MODELS.interpret;
    const { fetch, seen } = modelFetch({ [first]: 503 });
    const clock = new Date();
    const usage = new UsageMeter();

    const result = await createGeminiClient({ apiKey: 'chave-de-teste', fetch, now: () => clock }).generateJson({
      ...interpretRequest,
      usage,
    });

    assert.equal(result.explanation, 'Comédias leves e curtas dos anos 1990 na Netflix.');
    assert.deepEqual(seen, [first, second]);
    assert.deepEqual(usage.geminiQuotaHits(), []);
    assert.deepEqual([...(await usage.geminiModelsToSkip())], [first]);
    usage.skipGeminiModel(first, new Date(clock.getTime() + GEMINI_UNAVAILABLE_REST_MS - 1));
    assert.ok((await usage.geminiModelsToSkip()).has(first));
  });

  test('modelo que não responde no tempo limite: vai ao próximo', async () => {
    const [first, second] = GEMINI_MODELS.interpret;
    const { fetch, seen } = modelFetch({ [first]: 'hang' });
    const started = Date.now();

    const result = await createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson({
      ...interpretRequest,
      timeoutMs: 50,
    });

    assert.equal(result.explanation, 'Comédias leves e curtas dos anos 1990 na Netflix.');
    assert.deepEqual(seen, [first, second]);
    assert.ok(Date.now() - started < 5_000, 'esperou demais pelo modelo parado');
  });

  test('falha de rede: vai ao próximo', async () => {
    const [first, second] = GEMINI_MODELS.interpret;
    const { fetch, seen } = modelFetch({ [first]: 'network' });

    await createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson(interpretRequest);

    assert.deepEqual(seen, [first, second]);
  });

  test('prazo total esgotado: para sem tentar os outros modelos', async () => {
    const { fetch, seen } = modelFetch(Object.fromEntries(GEMINI_MODELS.interpret.map((model) => [model, 'hang'])));
    const started = Date.now();

    await assert.rejects(
      createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson({
        ...interpretRequest,
        timeoutMs: 10_000,
        budgetMs: 2_500,
      }),
      (error) => error instanceof SourceUnavailableError && /timed out/i.test(error.message),
    );

    assert.deepEqual(seen, [GEMINI_MODELS.interpret[0]]);
    assert.ok(Date.now() - started < 5_000, 'passou do prazo total');
  });

  test('erro que não é de disponibilidade (400): não tenta outro modelo', async () => {
    const { fetch, seen } = modelFetch({ [GEMINI_MODELS.interpret[0]]: 400 });

    await assert.rejects(
      createGeminiClient({ apiKey: 'chave-de-teste', fetch }).generateJson(interpretRequest),
      SourceUnavailableError,
    );

    assert.deepEqual(seen, [GEMINI_MODELS.interpret[0]]);
  });
});

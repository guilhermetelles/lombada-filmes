import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, test } from 'node:test';
import { InterpretReplySchema } from '../../lib/schemas/discover.js';
import { createGeminiClient } from '../../lib/sources/gemini/gemini-client.js';
import { GEMINI_MODELS } from '../../lib/sources/gemini/gemini-models.js';
import type { Fetch } from '../../lib/types/sources.js';
import { usageDay } from '../../lib/usage/usage-day.js';
import { GEMINI_QUOTA_DOC, UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';

/** Resposta real da Groq (qwen/qwen3.8-27b, 2026-10-23) à frase "comédia curta dos anos 90 na Netflix". */
const groqRecorded = readFileSync(new URL('../fixtures/groq-interpret.json', import.meta.url), 'utf8');

/** Resposta real do Gemini (gemini-3.8-flash, 2026-10-18) à mesma frase. */
const geminiRecorded = readFileSync(new URL('../fixtures/gemini-interpret.json', import.meta.url), 'utf8');

/** Um pedido recebido pelo fetch falso. */
type SeenRequest = { url: string; model: string; headers: Headers; body: Record<string, unknown> };

/**
 * Fetch falso que atende a Groq e o Gemini: por modelo, um status de erro, "hang" (sem resposta até
 * o tempo limite) ou, sem entrada, a resposta gravada do provedor.
 *
 * @param byModel - O que cada modelo faz.
 * @param headers - Cabeçalhos das respostas de erro (como o `retry-after`).
 * @returns O fetch e os pedidos vistos.
 */
function providersFetch(
  byModel: Record<string, number | 'hang'> = {},
  headers: Record<string, string> = {},
): { fetch: Fetch; seen: SeenRequest[] } {
  const seen: SeenRequest[] = [];
  const fetch: Fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const body = JSON.parse(await request.text());
    const model = String(body.model);
    seen.push({ url: request.url, model, headers: request.headers, body });
    const behavior = byModel[model];
    if (behavior === 'hang') {
      const signal = init?.signal ?? request.signal;
      return new Promise<Response>((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason)));
    }
    if (typeof behavior === 'number') {
      return new Response(`{"error":{"message":"falha ${behavior}"}}`, {
        status: behavior,
        headers: { 'content-type': 'application/json', ...headers },
      });
    }
    const recorded = request.url.includes('api.groq.com') ? groqRecorded : geminiRecorded;
    return new Response(recorded, { headers: { 'content-type': 'application/json' } });
  };
  return { fetch, seen };
}

const request = {
  model: GEMINI_MODELS.interpret,
  purpose: 'search' as const,
  system: 'instrução de teste',
  prompt: 'comédia curta dos anos 90 na Netflix',
  schema: InterpretReplySchema,
};

const [qwen, gptOss, firstGemini] = GEMINI_MODELS.interpret;

beforeEach(resetEmulators);

describe('modelos da Groq no cliente de texto', () => {
  test('o Qwen responde primeiro: modo strict, sem raciocínio, e os nulos saem antes do zod', async () => {
    const { fetch, seen } = providersFetch();
    const client = createGeminiClient({ apiKey: 'chave-gemini', groqApiKey: 'chave-groq', fetch });

    const result = await client.generateJson(request);

    assert.deepEqual(result, {
      filters: {
        dec: ['1990'],
        dur: ['ate90'],
        fit: false,
        genre: ['Comédia'],
        mood: ['leve'],
        svc: ['Netflix'],
        theme: [],
      },
      explanation: 'Comédias curtas dos anos 90 na Netflix.',
      keywords: [],
    });
    assert.equal(seen.length, 1);
    const [sent] = seen;
    assert.equal(sent?.url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(sent?.headers.get('authorization'), 'Bearer chave-groq');
    assert.equal(sent?.model, qwen);
    assert.equal(sent?.body.reasoning_effort, undefined);
    assert.deepEqual(sent?.body.messages, [
      { role: 'system', content: 'instrução de teste' },
      { role: 'user', content: 'comédia curta dos anos 90 na Netflix' },
    ]);
    const format = sent?.body.response_format as {
      json_schema: {
        strict: boolean;
        schema: { properties: { filters: Record<string, unknown>; keywords: Record<string, unknown> } };
      };
    };
    assert.equal(format.json_schema.strict, true);
    const filters = format.json_schema.schema.properties.filters as {
      required: string[];
      additionalProperties: boolean;
      properties: { mood: { type: unknown } };
    };
    // Sem `kw`: os ids das palavras-chave vêm do TMDb, nunca do modelo.
    assert.deepEqual(filters.required, ['mood', 'dur', 'dec', 'genre', 'theme', 'svc', 'fit']);
    assert.equal(filters.additionalProperties, false);
    assert.deepEqual(filters.properties.mood.type, ['array', 'null']);
    assert.equal(format.json_schema.schema.properties.keywords.maxItems, undefined);
  });

  test('429 da Groq: o próximo modelo (gpt-oss, com raciocínio baixo) responde e o Qwen fica pulado', async () => {
    const { fetch, seen } = providersFetch({ [qwen]: 429 }, { 'retry-after': '7' });
    const clock = new Date();
    const { db } = createTestDependencies(fakeSources().fetch);
    const usage = new UsageMeter({ db, now: () => clock });
    const client = createGeminiClient({ apiKey: 'chave-gemini', groqApiKey: 'chave-groq', fetch, now: () => clock });

    await client.generateJson({ ...request, usage });
    await usage.save(db, clock);

    assert.deepEqual(
      seen.map((sent) => sent.model),
      [qwen, gptOss],
    );
    assert.equal(seen[1]?.body.reasoning_effort, 'low');
    const day = (await db.doc(`usage/${usageDay(clock)}`).get()).data();
    assert.deepEqual(day?.groq, { calls: 2, errors: 1 });
    assert.equal(day?.gemini, undefined);
    assert.equal(day?.geminiModels[qwen].quota, 1);
    const quotas = (await db.doc(GEMINI_QUOTA_DOC).get()).data();
    assert.equal(quotas?.skipUntil[qwen].toMillis(), clock.getTime() + 7_000);
    assert.equal(quotas?.skipReason[qwen], 'quota');
  });

  test('Groq fora do ar ou sem responder: o pedido segue para o Gemini', async () => {
    const { fetch, seen } = providersFetch({ [qwen]: 503, [gptOss]: 'hang' });
    const client = createGeminiClient({ apiKey: 'chave-gemini', groqApiKey: 'chave-groq', fetch });

    const result = await client.generateJson({ ...request, timeoutMs: 50 });

    assert.equal(result.explanation, 'Comédias leves e curtas dos anos 1990 na Netflix.');
    assert.deepEqual(
      seen.map((sent) => sent.model),
      [qwen, gptOss, firstGemini],
    );
  });

  test('sem a chave da Groq, os modelos dela ficam de fora; sem nenhuma chave, falha sem pedido', async () => {
    const { fetch, seen } = providersFetch();

    await createGeminiClient({ apiKey: 'chave-gemini', fetch }).generateJson(request);
    assert.deepEqual(
      seen.map((sent) => sent.model),
      [firstGemini],
    );

    await assert.rejects(createGeminiClient({ apiKey: undefined, fetch }).generateJson(request), /nenhuma chave/);
    assert.equal(seen.length, 1);
  });
});

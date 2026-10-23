import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, test } from 'node:test';
import { interpretRoute } from '../../api/search/_interpret.js';
import { INTERPRET_DAILY_LIMIT } from '../../lib/discover/interpret-rate-limit.js';
import { createGeminiClient } from '../../lib/sources/gemini/gemini-client.js';
import { brazilDay } from '../../lib/time/brazil-day.js';
import type { GeminiClient } from '../../lib/types/sources.js';
import { usageDay } from '../../lib/usage/usage-day.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { createFakeGemini, type FakeGemini } from '../support/fake-gemini.js';
import { fakeSources } from '../support/fake-sources.js';
import { jsonRequest, readErrorCode } from '../support/requests.js';

/** 23h30 de 17/10 em Brasília (02h30 UTC de 18/10): o dia do limite é o de Brasília. */
const LATE_NIGHT = new Date('2026-10-18T02:30:00Z');

let gemini: FakeGemini;
let clock: Date;
let uid: string;
let idToken: string;

beforeEach(async () => {
  await resetEmulators();
  gemini = createFakeGemini();
  clock = LATE_NIGHT;
  ({ uid, idToken } = await signUp('pessoa@exemplo.com'));
});

/**
 * Chama a rota com o Gemini do teste.
 *
 * @param body - Corpo do pedido.
 * @param client - Gemini a usar (o falso, por padrão).
 * @param token - ID token (nenhum para testar 401).
 * @returns A resposta e as dependências usadas.
 */
async function interpret(body: unknown, client: GeminiClient = gemini.client, token: string | null = idToken) {
  const dependencies = createTestDependencies(fakeSources().fetch, () => clock, { gemini: client });
  // null = sem token (undefined acionaria o valor padrão do parâmetro).
  const response = await interpretRoute(() => dependencies)(
    jsonRequest('/api/search/interpret', body, token ?? undefined),
  );
  return { response, dependencies };
}

const reply = { filters: { genre: ['Terror'], dur: ['ate90'] }, explanation: 'Terror de até 90 minutos.' };

describe('POST /api/search/interpret', () => {
  test('devolve filtros e explicação e conta o uso do dia de Brasília', async () => {
    gemini.replies.push(reply);
    const { response, dependencies } = await interpret({ text: '  terror curto  ' });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ...reply, keywords: [] });
    assert.equal(gemini.requests[0]?.prompt, 'terror curto');
    const counter = await dependencies.db.doc(`rateLimits/${uid}_2026-10-17`).get();
    assert.equal(brazilDay(clock), '2026-10-17');
    assert.equal(counter.get('interpret'), 1);
  });

  test('com a resposta real gravada do Gemini: conta o pedido à fonte e à busca', async () => {
    const recorded = readFileSync(new URL('../fixtures/gemini-interpret.json', import.meta.url), 'utf8');
    const real = createGeminiClient({
      apiKey: 'chave-de-teste',
      fetch: async () => new Response(recorded, { headers: { 'content-type': 'application/json' } }),
    });
    const { response, dependencies } = await interpret({ text: 'comédia curta dos anos 90 na Netflix' }, real);

    assert.equal(response.status, 200);
    const usage = (await dependencies.db.doc(`usage/${usageDay(clock)}`).get()).data();
    assert.deepEqual(usage?.gemini, { calls: 1 });
    assert.deepEqual(usage?.geminiPurposes, { search: { requests: 1, answered: 1 } });
    assert.deepEqual(await response.json(), {
      filters: { mood: ['leve'], dur: ['ate90'], dec: ['1990'], genre: ['Comédia'], svc: ['Netflix'] },
      explanation: 'Comédias leves e curtas dos anos 1990 na Netflix.',
      keywords: [],
    });
  });

  test(`acima de ${INTERPRET_DAILY_LIMIT} no dia: 429 rate_limited sem chamar o Gemini; no dia seguinte volta`, async () => {
    for (let i = 0; i < INTERPRET_DAILY_LIMIT; i++) gemini.replies.push(reply);
    for (let i = 0; i < INTERPRET_DAILY_LIMIT; i++) {
      assert.equal((await interpret({ text: 'terror curto' })).response.status, 200);
    }
    assert.equal(gemini.requests.length, INTERPRET_DAILY_LIMIT);

    gemini.replies.push(reply);
    const blocked = await interpret({ text: 'terror curto' });
    assert.equal(blocked.response.status, 429);
    assert.equal(await readErrorCode(blocked.response), 'rate_limited');
    assert.equal(gemini.requests.length, INTERPRET_DAILY_LIMIT);

    // 00h30 de 18/10 em Brasília: dia novo, contador novo.
    clock = new Date('2026-10-18T03:30:00Z');
    assert.equal((await interpret({ text: 'terror curto' })).response.status, 200);
  });

  test('o limite é por pessoa', async () => {
    const { db } = createTestDependencies(fakeSources().fetch);
    await db.doc(`rateLimits/${uid}_2026-10-17`).set({ uid, day: '2026-10-17', interpret: INTERPRET_DAILY_LIMIT });
    const other = await signUp('outra@exemplo.com');
    gemini.replies.push(reply);
    const { response } = await interpret({ text: 'terror curto' }, gemini.client, other.idToken);
    assert.equal(response.status, 200);
  });

  test('texto curto ou longo demais: 400 sem contar nem chamar o Gemini', async () => {
    for (const text of ['a', ' a ', 'x'.repeat(201)]) {
      const { response, dependencies } = await interpret({ text });
      assert.equal(response.status, 400);
      assert.equal(await readErrorCode(response), 'invalid_input');
      assert.equal((await dependencies.db.doc(`rateLimits/${uid}_2026-10-17`).get()).exists, false);
    }
    assert.equal(gemini.requests.length, 0);
  });

  test('sem token: 401', async () => {
    const { response } = await interpret({ text: 'terror curto' }, gemini.client, null);
    assert.equal(response.status, 401);
    assert.equal(gemini.requests.length, 0);
  });

  test('sem GEMINI_API_KEY: 502 source_unavailable, sem pedido à API', async () => {
    let called = false;
    const withoutKey = createGeminiClient({
      apiKey: undefined,
      fetch: async () => {
        called = true;
        return new Response('{}');
      },
    });
    const { response } = await interpret({ text: 'terror curto' }, withoutKey);
    assert.equal(response.status, 502);
    assert.equal(await readErrorCode(response), 'source_unavailable');
    assert.equal(called, false);
  });
});

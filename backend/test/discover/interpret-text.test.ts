import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { INTERPRET_BUDGET_MS, INTERPRET_MODEL_TIMEOUT_MS, interpretText } from '../../lib/discover/interpret-text.js';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { createGeminiClient } from '../../lib/sources/gemini/gemini-client.js';
import { GEMINI_MODELS } from '../../lib/sources/gemini/gemini-models.js';
import { createFakeGemini } from '../support/fake-gemini.js';

describe('interpretText', () => {
  test('resposta real gravada do Gemini vira filtros e explicação', async () => {
    const recorded = readFileSync(new URL('../fixtures/gemini-interpret.json', import.meta.url), 'utf8');
    const gemini = createGeminiClient({
      apiKey: 'chave-de-teste',
      fetch: async () => new Response(recorded, { headers: { 'content-type': 'application/json' } }),
    });

    assert.deepEqual(await interpretText(gemini, 'comédia curta dos anos 90 na Netflix'), {
      filters: { mood: ['leve'], dur: ['ate90'], dec: ['1990'], genre: ['Comédia'], svc: ['Netflix'] },
      explanation: 'Comédias leves e curtas dos anos 1990 na Netflix.',
      keywords: [],
    });
  });

  test('manda a frase ao modelo de interpretação, com o vocabulário fechado na instrução', async () => {
    const gemini = createFakeGemini();
    gemini.replies.push({ filters: {}, explanation: 'Nada do pedido cabe nos filtros.' });

    await interpretText(gemini.client, 'qualquer coisa');

    const [request] = gemini.requests;
    assert.equal(request?.model, GEMINI_MODELS.interpret);
    assert.equal(request?.timeoutMs, INTERPRET_MODEL_TIMEOUT_MS);
    assert.equal(request?.budgetMs, INTERPRET_BUDGET_MS);
    assert.equal(request?.prompt, 'qualquer coisa');
    for (const value of ['ruim-divertido', 'mais120', 'antes70', 'Ficção científica', 'zumbis-vampiros', 'Globoplay']) {
      assert.ok(request?.system?.includes(value), `instrução sem ${value}`);
    }
  });

  test('gêneros e serviços viram os nomes do TMDb; desconhecidos, repetidos e grupos vazios saem', async () => {
    const gemini = createFakeGemini();
    gemini.replies.push({
      filters: {
        mood: ['tenso', 'tenso'],
        dur: [],
        genre: ['suspense', 'Thriller', 'Novela'],
        svc: ['prime video', 'Serviço Inventado'],
        theme: ['serial-killer'],
        fit: false,
      },
      explanation: '  Suspense com serial killer no Prime Video.  ',
    });

    assert.deepEqual(await interpretText(gemini.client, 'suspense de serial killer no prime'), {
      filters: { mood: ['tenso'], genre: ['Thriller'], theme: ['serial-killer'], svc: ['Amazon Prime Video'] },
      explanation: 'Suspense com serial killer no Prime Video.',
      keywords: [],
    });
  });

  test('Gemini indisponível: o erro sobe', async () => {
    const gemini = createFakeGemini();
    await assert.rejects(interpretText(gemini.client, 'terror curto'), SourceUnavailableError);
  });

  test('duração e década ditas no pedido valem mesmo quando o modelo as perde', async () => {
    const gemini = createFakeGemini();
    gemini.replies.push({
      filters: { mood: ['leve'], genre: ['Comédia'], dur: ['90a120'] },
      explanation: 'Comédias leves.',
    });

    const reply = await interpretText(gemini.client, 'comédia curta dos anos 90');

    assert.deepEqual(reply.filters, { mood: ['leve'], dur: ['ate90'], dec: ['1990'], genre: ['Comédia'] });
  });

  test('década sem palavra de época no pedido sai; com ela, fica', async () => {
    const gemini = createFakeGemini();
    gemini.replies.push({ filters: { genre: ['Romance'], dec: ['2020'] }, explanation: 'Romances no futuro.' });
    gemini.replies.push({ filters: { genre: ['Romance'], dec: ['2020'] }, explanation: 'Romances recentes.' });

    assert.deepEqual((await interpretText(gemini.client, 'romance futuro')).filters, { genre: ['Romance'] });
    assert.deepEqual((await interpretText(gemini.client, 'romance recente')).filters, {
      genre: ['Romance'],
      dec: ['2020'],
    });
  });
});

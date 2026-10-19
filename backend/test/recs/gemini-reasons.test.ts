import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { writeGeminiReasons } from '../../lib/recs/gemini-reasons.js';
import { buildListIndex, type ListFilmWithMovie, scoreMovie } from '../../lib/recs/score-recs.js';
import { GEMINI_MODELS } from '../../lib/sources/gemini/gemini-models.js';
import type { RecsModel } from '../../lib/types/recs.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createFakeGemini } from '../support/fake-gemini.js';
import { makeMovie } from './synthetic-movies.js';

const MODEL: RecsModel = { bias: -5.2, weights: { vote: 8 } };

const films: ListFilmWithMovie[] = [
  {
    entryId: 'e1',
    tmdbId: 1,
    position: 1,
    comment: 'A Joana gritou o filme inteiro, e o Pedro riu do monstro de borracha',
    watchedOn: '2025-01-01',
    movie: makeMovie({ title: 'Origem', genres: ['Terror'], keywords: ['monster'], directors: [{ id: 5, name: 'D' }] }),
  },
];
const index = buildListIndex(films, 1);
const recs = [
  scoreMovie(MODEL, index, 50, makeMovie({ title: 'Candidato', genres: ['Terror'], keywords: ['monster'] }), 'model'),
  scoreMovie(MODEL, index, 51, makeMovie({ title: 'Outro', genres: ['Terror'] }), 'model'),
];

describe('writeGeminiReasons', () => {
  test('um pedido para a lista inteira, com o modelo de texto e os comentários sem os nomes', async () => {
    const gemini = createFakeGemini();
    gemini.replies.push({
      reasons: [
        { tmdbId: 50, reason: 'Monstro de borracha como em Origem, o #1 de vocês' },
        { tmdbId: 51, reason: 'Curto' },
      ],
    });
    const { reasons, failure } = await writeGeminiReasons(gemini.client, new UsageMeter(), recs, index, [
      'Joana',
      'Pedro Silva',
    ]);
    assert.equal(failure, null);

    assert.equal(gemini.requests.length, 1);
    assert.equal(gemini.requests[0]?.model, GEMINI_MODELS.text);
    const prompt = gemini.requests[0]?.prompt ?? '';
    assert.ok(prompt.includes('A [nome] gritou o filme inteiro, e o [nome] riu do monstro de borracha'));
    assert.ok(!prompt.includes('Joana') && !prompt.includes('Pedro'));
    // Motivo curto demais é descartado (vai para a reserva).
    assert.deepEqual([...reasons], [[50, 'Monstro de borracha como em Origem, o #1 de vocês']]);
  });

  test('descarta motivo com [nome] e de filme que não foi pedido', async () => {
    const gemini = createFakeGemini();
    gemini.replies.push({
      reasons: [
        { tmdbId: 50, reason: 'A [nome] vai adorar este filme de monstro' },
        { tmdbId: 777, reason: 'Filme que ninguém pediu para explicar' },
      ],
    });
    const { reasons } = await writeGeminiReasons(gemini.client, new UsageMeter(), recs, index, []);
    assert.equal(reasons.size, 0);
  });

  test('Gemini fora do ar (ou sem chave): nenhum motivo, sem lançar, com o porquê resumido', async () => {
    const gemini = createFakeGemini();
    const { reasons, failure } = await writeGeminiReasons(gemini.client, new UsageMeter(), recs, index, []);
    assert.equal(reasons.size, 0);
    assert.equal(failure, 'sem resposta preparada no teste');
    assert.equal(gemini.requests.length, 1);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildRetroStats } from '../../lib/retro/build-retro-stats.js';
import { writeRetroText } from '../../lib/retro/retro-text.js';
import { countingUsage, SAMPLE_FILMS, sampleMaterial } from '../quiz/quiz-samples.js';
import { createFakeGemini } from '../support/fake-gemini.js';

/** Contexto do log nos testes. */
const LOG_CONTEXT = { listId: 'lista-teste', month: '2026-09' };

describe('buildRetroStats', () => {
  test('setembro de 2026: filmes, minutos, melhor e pior colocado e gêneros', () => {
    const { stats, monthEntries } = buildRetroStats(sampleMaterial().entries, '2026-09');

    // Vistos em setembro: The Abyss (#1), Signs (#2), Ocean's Eleven (#3) e Battlefield Earth (#8).
    assert.deepEqual(
      monthEntries.map((entry) => entry.title),
      ['The Abyss', 'Signs', "Ocean's Eleven", 'Battlefield Earth'],
    );
    assert.deepEqual(stats, {
      films: 4,
      minutes: 140 + 106 + 116 + 118,
      bestEntryId: 'entrada-2756',
      worstEntryId: 'entrada-5491',
      genres: [
        { genre: 'Ficção científica', count: 3 },
        { genre: 'Thriller', count: 2 },
        { genre: 'Ação', count: 1 },
        { genre: 'Aventura', count: 1 },
        { genre: 'Crime', count: 1 },
      ],
    });
  });

  test('um filme só no mês: há melhor, não há pior', () => {
    const { stats } = buildRetroStats(sampleMaterial().entries, '2026-08');
    assert.equal(stats.films, 1);
    assert.equal(stats.bestEntryId, 'entrada-8914');
    assert.equal(stats.worstEntryId, null);
  });

  test('mês sem filmes', () => {
    const { stats } = buildRetroStats(sampleMaterial().entries, '2024-01');
    assert.deepEqual(stats, { films: 0, minutes: 0, bestEntryId: null, worstEntryId: null, genres: [] });
  });
});

describe('writeRetroText', () => {
  const september = () => buildRetroStats(sampleMaterial().entries, '2026-09').monthEntries;

  test('manda ao Gemini os comentários do mês sem os nomes dos membros e devolve o parágrafo', async () => {
    const gemini = createFakeGemini();
    gemini.replies.push({ text: '  Setembro teve mergulho, plantação e câmera torta.  ' });
    const entries = september().map((entry) =>
      entry.tmdbId === 2675 ? { ...entry, comment: `${entry.comment} A Bia ficou com medo.` } : entry,
    );

    const text = await writeRetroText(
      { gemini: gemini.client, usage: countingUsage() },
      entries,
      ['Ana', 'Bia'],
      LOG_CONTEXT,
    );

    assert.equal(text, 'Setembro teve mergulho, plantação e câmera torta.');
    const prompt = gemini.requests[0]?.prompt ?? '';
    assert.ok(!prompt.includes('Bia') && prompt.includes('[nome] ficou com medo'));
    assert.ok(prompt.includes(SAMPLE_FILMS[0]?.comment ?? '-'));
  });

  test('Gemini fora do ar ou resposta com nome trocado: sem texto', async () => {
    assert.equal(
      await writeRetroText({ gemini: createFakeGemini().client, usage: countingUsage() }, september(), [], LOG_CONTEXT),
      null,
    );
    const gemini = createFakeGemini();
    gemini.replies.push({ text: '[nome] adorou o mês.' });
    assert.equal(
      await writeRetroText({ gemini: gemini.client, usage: countingUsage() }, september(), [], LOG_CONTEXT),
      null,
    );
  });

  test('mês sem comentários não chama o Gemini', async () => {
    const gemini = createFakeGemini();
    const usage = countingUsage();
    const entries = september().map((entry) => ({ ...entry, comment: '' }));
    assert.equal(await writeRetroText({ gemini: gemini.client, usage }, entries, [], LOG_CONTEXT), null);
    assert.equal(gemini.requests.length, 0);
    assert.equal(usage.calls, 0);
  });
});

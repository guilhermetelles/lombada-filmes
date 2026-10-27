import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { diversify } from '../../lib/recs/diversify.js';
import { fallbackReason } from '../../lib/recs/fallback-reason.js';
import { similarityTags, tagSimilarity } from '../../lib/recs/movie-features.js';
import { combineScores, findNeighbors, neighborScore } from '../../lib/recs/neighbors.js';
import {
  buildListIndex,
  feedbackAdjustment,
  type ListFilmWithMovie,
  scoreMovie,
  toRecItem,
} from '../../lib/recs/score-recs.js';
import type { RecsModel } from '../../lib/types/recs.js';
import { makeMovie } from './synthetic-movies.js';

const BASELINE: RecsModel = { bias: -5.2, weights: { vote: 8 } };

/** Lista de teste: três filmes, um de saga e dois do mesmo diretor. */
const films: ListFilmWithMovie[] = [
  {
    entryId: 'e1',
    tmdbId: 1,
    position: 1,
    comment: 'Comentário de teste um',
    watchedOn: '2025-01-01',
    movie: makeMovie({
      title: 'Primeiro',
      genres: ['Terror'],
      keywords: ['zombie', 'mall'],
      directors: [{ id: 10, name: 'Diretora A' }],
      year: 1978,
    }),
  },
  {
    entryId: 'e2',
    tmdbId: 2,
    position: 2,
    comment: '',
    watchedOn: '2025-02-01',
    movie: makeMovie({
      title: 'Segundo',
      genres: ['Ação'],
      collection: { id: 500, name: 'Saga X' },
      directors: [{ id: 20, name: 'Diretor B' }],
      year: 1990,
    }),
  },
  {
    entryId: 'e3',
    tmdbId: 3,
    position: 3,
    comment: '',
    watchedOn: '2025-03-01',
    movie: makeMovie({
      title: 'Terceiro',
      genres: ['Romance'],
      directors: [{ id: 10, name: 'Diretora A' }],
      year: 2010,
    }),
  },
];
const index = buildListIndex(films, films.length);

describe('vizinhos', () => {
  test('semelhança ponderada: diretor e saga pesam mais que gênero', () => {
    const a = similarityTags(makeMovie({ genres: ['Terror'], directors: [{ id: 1, name: 'x' }], year: null }));
    const sameDirector = similarityTags(
      makeMovie({ genres: ['Drama'], directors: [{ id: 1, name: 'x' }], year: null }),
    );
    const sameGenre = similarityTags(makeMovie({ genres: ['Terror'], directors: [{ id: 2, name: 'y' }], year: null }));
    assert.ok(tagSimilarity(a, sameDirector) > tagSimilarity(a, sameGenre));
  });

  test('vizinhos mais parecidos primeiro, e a nota pela posição deles', () => {
    const tags = similarityTags(makeMovie({ genres: ['Terror'], keywords: ['zombie'], year: 1979 }));
    const neighbors = findNeighbors(tags, index.tags);
    assert.equal(neighbors[0]?.entryId, 'e1');
    assert.equal(neighborScore([{ entryId: 'e1', position: 1, similarity: 0.5 }], 3), 100);
    assert.equal(neighborScore([{ entryId: 'e3', position: 3, similarity: 0.5 }], 3), 0);
    assert.equal(neighborScore([], 3), null);
  });

  test('vizinhos pesam até 30% na nota final', () => {
    assert.equal(combineScores(50, [], 3), 50);
    assert.equal(combineScores(50, [{ entryId: 'e1', position: 1, similarity: 0.9 }], 3), 65);
    assert.equal(combineScores(50, [{ entryId: 'e1', position: 1, similarity: 0.15 }], 3), 58);
  });
});

describe('scoreMovie', () => {
  test('saga da lista vira kind saga, com o filme da lista em reasonFrom', () => {
    const rec = scoreMovie(
      BASELINE,
      index,
      99,
      makeMovie({ genres: ['Ação'], collection: { id: 500, name: 'Saga X' } }),
      'model',
    );
    assert.equal(rec.kind, 'saga');
    assert.equal(rec.reasonFrom[0], 'e2');
    assert.equal(fallbackReason(rec, index, BASELINE), 'Da saga Saga X, como Segundo, #2 na lista de vocês');
  });

  test('o motivo por regra cita a saga sem "Coleção" nem "Collection"', () => {
    for (const name of [
      'Saga X - Coleção',
      'Saga X: Coleção',
      'Saga X Coleção',
      'Saga X Collection',
      'Coleção Saga X',
    ]) {
      const rec = scoreMovie(
        BASELINE,
        index,
        99,
        makeMovie({ genres: ['Ação'], collection: { id: 500, name } }),
        'model',
      );
      assert.equal(fallbackReason(rec, index, BASELINE), 'Da saga Saga X, como Segundo, #2 na lista de vocês', name);
    }
  });

  test('diretor da lista vira kind diretor, ligado ao filme mais alto dele', () => {
    const rec = scoreMovie(
      BASELINE,
      index,
      98,
      makeMovie({ genres: ['Drama'], directors: [{ id: 10, name: 'Diretora A' }] }),
      'model',
    );
    assert.equal(rec.kind, 'diretor');
    assert.equal(rec.anchor?.film.entryId, 'e1');
    assert.equal(fallbackReason(rec, index, BASELINE), 'Mesmo diretor de Primeiro (Diretora A), #1 na lista de vocês');
  });

  test('sem saga nem diretor: tema, motivo pelo filme mais parecido', () => {
    const rec = scoreMovie(
      BASELINE,
      index,
      97,
      makeMovie({ genres: ['Terror'], keywords: ['zombie'], year: 1979 }),
      'model',
    );
    assert.equal(rec.kind, 'tema');
    // Sem rótulo em português, a palavra-chave não aparece; com ele, aparece traduzida.
    assert.equal(fallbackReason(rec, index, BASELINE), 'Parecido com Primeiro, #1 na lista de vocês (Terror)');
    const labeled = { ...BASELINE, labels: { zombie: 'zumbis' } };
    assert.equal(fallbackReason(rec, index, labeled), 'Parecido com Primeiro, #1 na lista de vocês (zumbis, Terror)');
  });

  test('em alta: kind emAlta e motivo com o prefixo da origem', () => {
    const rec = scoreMovie(BASELINE, index, 96, makeMovie({ genres: ['Animação'], year: null }), 'trending');
    assert.equal(rec.kind, 'emAlta');
    assert.equal(fallbackReason(rec, index, BASELINE), 'Em alta nesta semana');
    const item = toRecItem(rec, 'motivo', 'rules');
    assert.equal(item.source, 'trending');
    assert.ok(Number.isInteger(item.score) && item.score >= 0 && item.score <= 100);
    assert.equal(item.reasonBy, 'rules');
  });
});

describe('diversify', () => {
  const item = (tmdbId: number, score: number, groups: string[]) => ({
    tmdbId,
    score,
    groups,
    tags: new Map(groups.map((g) => [g, 1])),
  });

  test('no máximo 1 por saga e por diretor entre os 10 primeiros', () => {
    const items = [
      item(1, 95, ['collection:1']),
      item(2, 94, ['collection:1']),
      item(3, 93, ['director:7']),
      item(4, 92, ['director:7', 'collection:2']),
      item(5, 60, ['director:8']),
    ];
    const ordered = diversify(items).map((i) => i.score);
    assert.deepEqual(ordered, [95, 93, 60, 94, 92]);
  });

  test('no máximo 2 da mesma origem entre os 10 primeiros', () => {
    const items = [
      item(1, 95, ['origin:seed:10']),
      item(2, 94, ['origin:seed:10']),
      item(3, 93, ['origin:seed:10']),
      item(4, 50, ['origin:queue:20']),
    ];
    assert.deepEqual(
      diversify(items).map((i) => i.tmdbId),
      [1, 2, 4, 3],
    );
  });

  test('empate de nota desempata pelo id, em qualquer ordem de entrada', () => {
    const items = [item(30, 80, []), item(10, 80, []), item(20, 80, [])];
    assert.deepEqual(
      diversify(items).map((i) => i.tmdbId),
      [10, 20, 30],
    );
    assert.deepEqual(
      diversify([...items].reverse()).map((i) => i.tmdbId),
      [10, 20, 30],
    );
  });
});

describe('ajuste pela fila e pelos dispensados', () => {
  const zombie = makeMovie({
    genres: ['Terror'],
    keywords: ['zombie', 'mall'],
    directors: [{ id: 10, name: 'Diretora A' }],
    year: 1978,
  });
  // Com o número de palavras-chave de um filme de verdade (o TMDb costuma trazer de 10 a 20).
  const filler = (prefix: string) => Array.from({ length: 8 }, (_, index) => `${prefix} ${index}`);
  const candidate = makeMovie({
    genres: ['Terror'],
    keywords: ['zombie', 'mall', ...filler('candidato')],
    directors: [{ id: 10, name: 'Diretora A' }],
    year: 1979,
  });
  const onlyGenre = makeMovie({ genres: ['Terror'], keywords: ['space', 'robot', ...filler('outro')], year: 2015 });
  const plain = scoreMovie(BASELINE, index, 95, candidate, 'model');

  test('dispensado parecido baixa a nota e não vira vizinho nem justificativa', () => {
    const withDismissed = buildListIndex(films, films.length, { queued: [], dismissed: [zombie] });
    const rec = scoreMovie(BASELINE, withDismissed, 95, candidate, 'model');
    assert.ok(rec.score < plain.score, `${rec.score} < ${plain.score}`);
    assert.deepEqual(rec.neighbors, plain.neighbors);
    assert.deepEqual(rec.reasonFrom, plain.reasonFrom);
    assert.ok(Number.isInteger(rec.score));
  });

  test('da fila parecido sobe a nota', () => {
    const withQueued = buildListIndex(films, films.length, { queued: [zombie], dismissed: [] });
    const rec = scoreMovie(BASELINE, withQueued, 95, candidate, 'model');
    assert.ok(rec.score > plain.score, `${rec.score} > ${plain.score}`);
  });

  test('parecido só no gênero e na década não mexe na nota', () => {
    const tags = similarityTags(candidate);
    assert.equal(feedbackAdjustment(tags, { queued: [], dismissed: [similarityTags(onlyGenre)] }), 0);
  });
});

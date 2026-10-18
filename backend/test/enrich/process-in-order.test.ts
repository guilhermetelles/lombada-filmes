import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { findRecurrentPeople } from '../../lib/enrich/enrich-targets.js';
import { processInOrder } from '../../lib/enrich/process-in-order.js';
import type { Movie } from '../../lib/types/movie.js';
import { tmdbAbyss } from '../support/movie-samples.js';

const forever = { expired: () => false };

describe('processInOrder', () => {
  test('trata tudo em lotes, a partir do cursor', async () => {
    const batches: number[][] = [];
    const progress = await processInOrder([1, 2, 3, 4, 5], 2, 2, forever, async (batch) => {
      batches.push(batch);
      return batch.length;
    });

    assert.deepEqual(batches, [[3, 4], [5]]);
    assert.deepEqual(progress, { completed: true, last: 5 });
  });

  test('para quando o tempo acaba, guardando o último tratado', async () => {
    let batches = 0;
    const budget = { expired: () => batches >= 1 };
    const progress = await processInOrder([1, 2, 3, 4], null, 2, budget, async (batch) => {
      batches++;
      return batch.length;
    });

    assert.deepEqual(progress, { completed: false, last: 2 });
  });

  test('para quando o lote é tratado só em parte (cota)', async () => {
    const progress = await processInOrder([1, 2, 3, 4], null, 3, forever, async () => 1);
    assert.deepEqual(progress, { completed: false, last: 1 });
  });

  test('nada a tratar: termina com o cursor como estava', async () => {
    assert.deepEqual(await processInOrder([1, 2], 2, 5, forever, async () => 0), { completed: true, last: 2 });
  });
});

describe('findRecurrentPeople', () => {
  /** Filme com diretores e elenco escolhidos. */
  const movie = (directorIds: number[], castIds: number[]): Movie => ({
    ...tmdbAbyss,
    directors: directorIds.map((id) => ({ id, name: `D${id}` })),
    cast: castIds.map((id) => ({ id, name: `A${id}`, character: null, profilePath: null })),
    ids: { imdb: null, letterboxd: null },
    ratings: {},
    tmdbFetchedAt: new Date(0),
  });

  test('quem aparece em 2 ou mais filmes da mesma lista (diretor ou 8 primeiros do elenco)', () => {
    const movies = new Map([
      [1, movie([10], [100, 101, 102, 103, 104, 105, 106, 107, 108])],
      [2, movie([10], [101, 200, 201, 202, 203, 204, 205, 206, 108])],
      [3, movie([30], [100])],
    ]);
    const lists = new Map([
      ['L1', [1, 2]],
      ['L2', [1, 3]],
    ]);

    // 10 dirige 1 e 2 (L1); 101 atua em 1 e 2 (L1); 100 atua em 1 e 3 (L2); 108 é o 9º do elenco.
    assert.deepEqual(findRecurrentPeople(lists, movies), [10, 100, 101]);
  });

  test('o mesmo filme repetido numa lista não conta duas vezes', () => {
    const movies = new Map([[1, movie([10], [])]]);
    assert.deepEqual(findRecurrentPeople(new Map([['L1', [1, 1]]]), movies), []);
  });
});

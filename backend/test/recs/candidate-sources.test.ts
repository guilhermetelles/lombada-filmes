import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { chooseCandidateIds } from '../../lib/recs/gather-candidates.js';
import { keywordCandidates } from '../../lib/recs/keyword-candidates.js';
import { createRecsRun, DEFAULT_RECS_LIMITS } from '../../lib/recs/recs-run.js';
import type { ListFilm } from '../../lib/recs/score-recs.js';
import type { Movie } from '../../lib/types/movie.js';
import type { RecsModel } from '../../lib/types/recs.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { type FakeTmdb, fakeTmdb } from './fake-tmdb.js';
import { makeMovie } from './synthetic-movies.js';

const clock = new Date('2026-10-18T08:00:00Z');

let tmdb: FakeTmdb;
let dependencies: ReturnType<typeof createTestDependencies>;

beforeEach(async () => {
  await resetEmulators();
  tmdb = fakeTmdb({}, {}, { zombie: { id: 12377, movies: [801, 802, 803] }, mall: { id: 4000, movies: [811] } });
  dependencies = createTestDependencies(tmdb.fetch, () => clock);
});

const newRun = (maxCandidates = DEFAULT_RECS_LIMITS.maxCandidates) =>
  createRecsRun(dependencies, new UsageMeter(), { ...DEFAULT_RECS_LIMITS, maxCandidates });

/** Modelo com duas palavras-chave a favor, uma marca técnica de peso maior e uma sem rótulo. */
const MODEL: RecsModel = {
  bias: 0,
  weights: { 'keyword:zombie': 1.2, 'keyword:mall': 0.6, 'keyword:aftercreditsstinger': 2, 'keyword:robot': 0.9 },
  labels: { zombie: 'zumbis', mall: 'shopping', aftercreditsstinger: '', robot: '' },
};

describe('palavras-chave como fonte', () => {
  test('as de maior peso, sem marca técnica nem sem rótulo, com os filmes do /discover', async () => {
    const found = await keywordCandidates(newRun(), MODEL, 1);
    assert.deepEqual(found.names, ['zombie', 'mall']);
    assert.deepEqual(
      found.seeds.map(({ keywordId, weight, tmdbIds }) => [keywordId, weight, tmdbIds]),
      [
        [12377, 1, [801, 802, 803]],
        [4000, 0.5, [811]],
      ],
    );
    assert.ok(tmdb.listCalls.some((call) => call.includes('with_keywords=12377')));
    assert.equal((await dependencies.db.doc('keywordIds/zombie').get()).get('id'), 12377);
  });

  test('modelo pouco confiável não busca nada', async () => {
    const found = await keywordCandidates(newRun(), MODEL, 0.3);
    assert.deepEqual(found, { names: [], seeds: [] });
    assert.deepEqual(tmdb.listCalls, []);
  });
});

describe('vagas por fonte', () => {
  test('fila e palavras-chave entram mesmo com as recomendações do topo pesando mais', async () => {
    const films: ListFilm[] = Array.from({ length: 25 }, (_, index) => ({
      entryId: `e${index}`,
      tmdbId: 100 + index,
      position: index + 1,
      comment: '',
      watchedOn: null,
    }));
    const movies = new Map<number, Movie>(
      films.map((film, index) => [
        film.tmdbId,
        makeMovie({ recs: Array.from({ length: 10 }, (_, rank) => 1000 + index * 10 + rank) }),
      ]),
    );
    movies.set(900, makeMovie({ recs: [901, 902, 903, 904, 905] }));

    const chosen = await chooseCandidateIds(newRun(30), films, movies, new Set(), {
      queued: [900],
      keywords: [{ keywordId: 12377, weight: 1, tmdbIds: [951, 952, 953] }],
    });
    assert.equal(chosen.ids.length, 30);
    for (const tmdbId of [901, 902, 903, 904, 905, 951, 952, 953]) assert.ok(chosen.ids.includes(tmdbId), `${tmdbId}`);
    assert.equal(chosen.sources.queue, 5);
    assert.equal(chosen.sources.keyword, 3);
    assert.equal(chosen.sources.list, 22);
    assert.equal(chosen.origins.get(901), 'origin:queue:900');
    assert.equal(chosen.origins.get(951), 'origin:keyword:12377');
    assert.equal(chosen.origins.get(1000), 'origin:seed:100');
  });
});

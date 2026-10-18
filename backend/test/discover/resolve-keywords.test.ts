import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { resolveKeywords } from '../../lib/discover/resolve-keywords.js';
import type { TmdbDiscoverClient, TmdbKeyword } from '../../lib/discover/tmdb-discover-client.js';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';

/** Resultados de /search/keyword por termo, como o TMDb devolveria. */
const SEARCH: Record<string, TmdbKeyword[]> = {
  shark: [
    { id: 5000, name: 'shark attack' },
    { id: 15097, name: 'shark' },
  ],
  'time loop': [{ id: 4379, name: 'time loop' }],
  'nada assim': [],
};

let searched: string[];
let tmdb: TmdbDiscoverClient;

beforeEach(async () => {
  await resetEmulators();
  searched = [];
  tmdb = {
    discover: async () => ({ page: 1, totalPages: 0, results: [] }),
    trendingWeek: async () => [],
    movieExtras: async () => ({ runtime: null, providers: [], keywords: [] }),
    async searchKeyword(query) {
      searched.push(query);
      if (query === 'falha') throw new SourceUnavailableError('tmdb', 'fora do ar');
      return SEARCH[query] ?? [];
    },
  };
});

describe('resolveKeywords', () => {
  test('prefere o nome igual ao termo, tira repetidos e termos sem palavra-chave, e guarda no cache', async () => {
    const { db } = createTestDependencies(fakeSources().fetch);
    const now = () => new Date('2026-10-18T22:00:00Z');
    const terms = [
      { term: 'Shark', label: 'tubarão' },
      { term: 'time loop', label: 'loop temporal' },
      { term: 'shark', label: 'tubarão de novo' },
      { term: 'nada assim', label: 'nada' },
      { term: 'falha', label: 'falha' },
    ];

    const found = await resolveKeywords({ db, tmdb, usage: new UsageMeter(), now }, terms);
    assert.deepEqual(found, [
      { id: 15097, label: 'tubarão' },
      { id: 4379, label: 'loop temporal' },
    ]);
    assert.deepEqual(searched, ['shark', 'time loop', 'nada assim', 'falha']);

    // Na segunda vez, tudo vem do cache (inclusive "nada assim", guardado sem id); só a falha é buscada de novo.
    searched = [];
    await resolveKeywords({ db, tmdb, usage: new UsageMeter(), now }, terms);
    assert.deepEqual(searched, ['falha']);
    assert.equal((await db.doc('keywordIds/nada assim').get()).get('id'), null);
  });
});

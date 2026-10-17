import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { backfillCast } from '../../lib/maintenance/backfill-cast.js';
import { findMovie } from '../../lib/movies/movie-repository.js';
import { findPerson } from '../../lib/people/person-repository.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';

let sources: FakeSources;
let dependencies: ReturnType<typeof createTestDependencies>;

/** Filme e pessoa como foram gravados antes do passo 9: sem `cast` e sem `acted`. */
async function writeLegacyDocuments(): Promise<void> {
  const fetchedAt = new Date('2026-10-16T15:00:00Z');
  await dependencies.db.doc('movies/2756').set({
    title: 'The Abyss',
    year: 1989,
    directors: [{ id: 2710, name: 'James Cameron' }],
    runtime: 140,
    genres: ['Aventura'],
    synopsis: { pt: null, en: null },
    posterPath: null,
    ids: { imdb: 'tt0096754', letterboxd: null },
    ratings: { imdb: { value: 7.5, votes: 211_000, fetchedAt } },
    tmdbFetchedAt: fetchedAt,
  });
  await dependencies.db.doc('people/2710').set({
    name: 'James Cameron',
    birthday: '1954-08-16',
    deathday: null,
    placeOfBirth: null,
    biography: null,
    bioLang: null,
    profilePath: null,
    imdbId: null,
    directedCount: 21,
    directed: [],
    fetchedAt,
  });
}

const backfill = (dryRun: boolean) => backfillCast({ dependencies, usage: new UsageMeter(), dryRun });

beforeEach(async () => {
  await resetEmulators();
  sources = fakeSources();
  dependencies = createTestDependencies(sources.fetch);
  await writeLegacyDocuments();
});

describe('recarga do elenco', () => {
  test('documentos antigos são lidos sem erro, com elenco e filmes atuados vazios', async () => {
    assert.deepEqual((await findMovie(dependencies.db, 2756))?.cast, []);
    const person = await findPerson(dependencies.db, 2710);
    assert.deepEqual([person?.actedCount, person?.acted], [0, []]);
  });

  test('ensaio busca no TMDb, mas não grava nada', async () => {
    const report = await backfill(true);

    assert.deepEqual(report, {
      movies: { missing: 1, updated: 0, failed: 0 },
      people: { missing: 1, updated: 0, failed: 0 },
    });
    assert.equal(sources.calls.tmdb, 2);
    assert.equal((await dependencies.db.doc('movies/2756').get()).get('cast'), undefined);
  });

  test('grava o elenco sem mexer nas notas e completa a pessoa; a segunda vez não faz nada', async () => {
    const report = await backfill(false);

    assert.deepEqual(report.movies, { missing: 1, updated: 1, failed: 0 });
    const movie = await findMovie(dependencies.db, 2756);
    assert.equal(movie?.cast[0]?.name, 'Ed Harris');
    assert.equal(movie?.ratings.imdb?.value, 7.5);
    assert.equal((await findPerson(dependencies.db, 2710))?.actedCount, 83);

    Object.assign(sources.calls, { tmdb: 0 });
    const again = await backfill(false);
    assert.deepEqual(again.movies.missing + again.people.missing, 0);
    assert.equal(sources.calls.tmdb, 0);
  });

  test('uma falha no TMDb é contada e não para as outras', async () => {
    sources.failing.add('tmdb');
    const report = await backfill(false);
    assert.deepEqual(report.movies, { missing: 1, updated: 0, failed: 1 });
    assert.deepEqual(report.people, { missing: 1, updated: 0, failed: 1 });
  });
});

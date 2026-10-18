import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { FieldValue } from 'firebase-admin/firestore';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { fetchMovieFeatures } from '../../lib/movies/fetch-movie-features.js';
import { EXTRA_FRESHNESS_MS, FRESHNESS_MS } from '../../lib/movies/freshness.js';
import { getFreshMovie } from '../../lib/movies/get-fresh-movie.js';
import { findMovie } from '../../lib/movies/movie-repository.js';
import { DAY_MS } from '../../lib/time/durations.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';

const NO_CALLS = { tmdb: 0, omdb: 0, letterboxd: 0, bechdel: 0 };

let sources: FakeSources;
let clock: Date;
let dependencies: ReturnType<typeof createTestDependencies>;

beforeEach(async () => {
  await resetEmulators();
  sources = fakeSources();
  clock = new Date('2026-10-16T12:00:00Z');
  dependencies = createTestDependencies(sources.fetch, () => clock);
});

const advanceClock = (ms: number) => {
  clock = new Date(clock.getTime() + ms);
};
const forgetCalls = () => Object.assign(sources.calls, NO_CALLS);
const openAbyss = () => getFreshMovie(2756, dependencies, new UsageMeter());
const featuresOfAbyss = () => fetchMovieFeatures(2756, dependencies, new UsageMeter());

describe('getFreshMovie: campos extras', () => {
  test('The Abyss vem com titlePt, keywords, recs, providersBR e extraFetchedAt', async () => {
    const movie = await openAbyss();

    assert.equal(movie.titlePt, 'O Segredo do Abismo');
    assert.ok((movie.keywords?.length ?? 0) > 0);
    assert.equal(movie.recs?.length, 10);
    assert.deepEqual(movie.providersBR?.flatrate, ['Disney Plus']);
    assert.equal(movie.certBR, 'L');
    assert.equal(movie.boxOfficeUS, 54_981_151);
    assert.equal(movie.extraFetchedAt?.getTime(), clock.getTime());
    assert.equal((await findMovie(dependencies.db, 2756))?.extraFetchedAt?.getTime(), clock.getTime());
  });

  test('segunda abertura no mesmo mês não busca os campos extras de novo', async () => {
    await openAbyss();
    forgetCalls();
    advanceClock(DAY_MS);

    await openAbyss();

    assert.deepEqual(sources.calls, NO_CALLS);
  });

  test('depois de 7 dias, o TMDb atualiza os extras sem mudar extraFetchedAt', async () => {
    const first = await openAbyss();
    advanceClock(FRESHNESS_MS);

    const movie = await openAbyss();

    assert.equal(movie.extraFetchedAt?.getTime(), first.extraFetchedAt?.getTime());
    assert.equal(movie.tmdbFetchedAt.getTime(), clock.getTime());
  });

  test('filme guardado sem campos extras (antes da versão 0.3): busca TMDb e OMDb mesmo frescos', async () => {
    await openAbyss();
    await dependencies.db.doc('movies/2756').update({
      extraFetchedAt: FieldValue.delete(),
      keywords: FieldValue.delete(),
      titlePt: FieldValue.delete(),
    });
    forgetCalls();

    const movie = await openAbyss();

    assert.deepEqual(sources.calls, { ...NO_CALLS, tmdb: 1, omdb: 1 });
    assert.equal(movie.titlePt, 'O Segredo do Abismo');
    assert.ok(movie.extraFetchedAt);
  });

  test('depois de 30 dias, os campos extras são buscados de novo', async () => {
    await openAbyss();
    advanceClock(EXTRA_FRESHNESS_MS);
    forgetCalls();

    const movie = await openAbyss();

    assert.equal(sources.calls.tmdb, 1);
    assert.equal(sources.calls.omdb, 1);
    assert.equal(movie.extraFetchedAt?.getTime(), clock.getTime());
  });
});

describe('fetchMovieFeatures', () => {
  test('filme novo: só o TMDb, sem notas nem extraFetchedAt', async () => {
    const movie = await featuresOfAbyss();

    assert.deepEqual(sources.calls, { ...NO_CALLS, tmdb: 1 });
    assert.equal(movie.title, 'The Abyss');
    assert.ok((movie.keywords?.length ?? 0) > 0);
    assert.deepEqual(movie.providersBR?.flatrate, ['Disney Plus']);
    assert.deepEqual(movie.ratings, {});
    assert.equal(movie.extraFetchedAt, undefined);
    assert.ok(await findMovie(dependencies.db, 2756));
  });

  test('TMDb fresco com os campos extras: devolve o guardado sem pedido', async () => {
    await featuresOfAbyss();
    forgetCalls();
    advanceClock(DAY_MS);

    await featuresOfAbyss();

    assert.deepEqual(sources.calls, NO_CALLS);
  });

  test('guardado sem campos extras ou com o TMDb vencido: busca o TMDb e mantém as notas', async () => {
    await openAbyss();
    await dependencies.db.doc('movies/2756').update({ keywords: FieldValue.delete() });
    forgetCalls();

    const movie = await featuresOfAbyss();

    assert.deepEqual(sources.calls, { ...NO_CALLS, tmdb: 1 });
    assert.equal(movie.ratings.imdb?.value, 7.5);
    assert.ok(movie.keywords);
  });

  test('TMDb fora do ar: devolve o guardado; sem guardado, SourceUnavailableError', async () => {
    sources.failing.add('tmdb');
    await assert.rejects(featuresOfAbyss(), SourceUnavailableError);

    sources.failing.clear();
    await featuresOfAbyss();
    advanceClock(FRESHNESS_MS);
    sources.failing.add('tmdb');

    const movie = await featuresOfAbyss();
    assert.equal(movie.title, 'The Abyss');
  });
});

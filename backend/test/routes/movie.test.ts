import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { movieRoute } from '../../api/movies/[tmdbId].js';
import { FRESHNESS_MS } from '../../lib/movies/freshness.js';
import type { Fetch } from '../../lib/types/sources.js';
import { usageDay } from '../../lib/usage/usage-day.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';
import { getRequest, readErrorCode, withBearer } from '../support/requests.js';

/** Corpo da resposta como o app recebe (datas em texto ISO). */
type RatingBody = { value: number | null; fetchedAt: string };
type MovieBody = {
  tmdbId: number;
  title: string;
  ratings: { imdb?: RatingBody; letterboxd?: RatingBody; rottenTomatoes?: RatingBody; metacritic?: RatingBody };
};

const NO_CALLS = { tmdb: 0, omdb: 0, letterboxd: 0 };

let sources: FakeSources;
let clock: Date;
let dependencies: ReturnType<typeof createTestDependencies>;
let idToken: string;

beforeEach(async () => {
  await resetEmulators();
  sources = fakeSources();
  clock = new Date('2026-10-16T15:00:00Z');
  dependencies = createTestDependencies(sources.fetch, () => clock);
  ({ idToken } = await signUp('pessoa@exemplo.com'));
});

const getMovie = (path: string, init: RequestInit = withBearer(idToken)) =>
  movieRoute(() => dependencies)(getRequest(path, init));
const getAbyss = () => getMovie('/api/movies/2756?tmdbId=2756');
const readMovie = async (response: Response) => (await response.json()) as MovieBody;
const usageToday = async () => (await dependencies.db.doc(`usage/${usageDay(clock)}`).get()).data();
const advanceClock = (ms: number) => {
  clock = new Date(clock.getTime() + ms);
};
const forgetCalls = () => Object.assign(sources.calls, NO_CALLS);

describe('GET /api/movies/{tmdbId}: frescor', () => {
  test('The Abyss vem com as quatro notas, fica gravado e gasta um pedido por fonte', async () => {
    const response = await getAbyss();
    const movie = await readMovie(response);

    assert.equal(response.status, 200);
    assert.equal(movie.tmdbId, 2756);
    assert.equal(movie.title, 'The Abyss');
    assert.equal(movie.ratings.imdb?.value, 7.5);
    assert.equal(movie.ratings.letterboxd?.value, 3.72);
    assert.equal(movie.ratings.rottenTomatoes?.value, 75);
    assert.equal(movie.ratings.metacritic?.value, 62);
    assert.equal(movie.ratings.imdb?.fetchedAt, clock.toISOString());
    assert.deepEqual(sources.calls, { tmdb: 1, omdb: 1, letterboxd: 1 });
    assert.equal((await dependencies.db.doc('movies/2756').get()).exists, true);
    assert.deepEqual(await usageToday(), {
      tmdb: { calls: 1 },
      letterboxd: { calls: 1 },
      omdb: { calls: 1, dailyLimit: 1000 },
    });
  });

  test('segunda chamada no mesmo dia não faz pedidos externos', async () => {
    await getAbyss();
    forgetCalls();

    const movie = await readMovie(await getAbyss());

    assert.equal(movie.ratings.imdb?.value, 7.5);
    assert.deepEqual(sources.calls, NO_CALLS);
    const usage = await usageToday();
    assert.deepEqual([usage?.tmdb.cacheHits, usage?.letterboxd.cacheHits, usage?.omdb.cacheHits], [1, 1, 1]);
  });

  test('depois de 7 dias busca as três fontes de novo', async () => {
    await getAbyss();
    forgetCalls();
    advanceClock(FRESHNESS_MS);

    await getAbyss();

    assert.deepEqual(sources.calls, { tmdb: 1, omdb: 1, letterboxd: 1 });
  });
});

describe('GET /api/movies/{tmdbId}: fonte sem o filme', () => {
  test('OMDb sem o filme: as notas ficam null e não é pedida de novo antes de 7 dias', async () => {
    const withoutOmdb: Fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.hostname === 'www.omdbapi.com') {
        sources.calls.omdb++;
        return Response.json({ Response: 'False', Error: 'Movie not found!' });
      }
      return sources.fetch(input, init);
    };
    dependencies = createTestDependencies(withoutOmdb, () => clock);

    const first = await readMovie(await getAbyss());
    await getAbyss();

    assert.equal(first.ratings.imdb?.value, null);
    assert.equal(sources.calls.omdb, 1);
  });
});

describe('GET /api/movies/{tmdbId}: fontes fora do ar', () => {
  test('Letterboxd fora do ar: as outras notas são gravadas e o erro é contado', async () => {
    sources.failing.add('letterboxd');

    const movie = await readMovie(await getAbyss());

    assert.equal(movie.ratings.letterboxd, undefined);
    assert.equal(movie.ratings.imdb?.value, 7.5);
    assert.deepEqual((await usageToday())?.letterboxd, { calls: 1, errors: 1 });
  });

  test('na atualização, a nota guardada continua valendo, com a data dela', async () => {
    const firstFetch = clock.toISOString();
    await getAbyss();
    advanceClock(FRESHNESS_MS);
    sources.failing.add('omdb');

    const movie = await readMovie(await getAbyss());

    assert.equal(movie.ratings.imdb?.value, 7.5);
    assert.equal(movie.ratings.imdb?.fetchedAt, firstFetch);
    assert.equal(movie.ratings.letterboxd?.fetchedAt, clock.toISOString());
  });

  test('TMDb fora do ar sem documento guardado: 502 e nada gravado', async () => {
    sources.failing.add('tmdb');

    const response = await getAbyss();

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: { code: 'source_unavailable', message: 'tmdb indisponível' } });
    assert.equal((await dependencies.db.doc('movies/2756').get()).exists, false);
  });
});

describe('GET /api/movies/{tmdbId}: entrada', () => {
  test('filme inexistente no TMDb: 404', async () => {
    const response = await getMovie('/api/movies/99999999?tmdbId=99999999');

    assert.equal(response.status, 404);
    assert.equal(await readErrorCode(response), 'not_found');
  });

  test('tmdbId inválido: 400 sem pedidos externos', async () => {
    for (const tmdbId of ['abc', '0', '012', '123456789']) {
      const response = await getMovie(`/api/movies/${tmdbId}?tmdbId=${tmdbId}`);
      assert.equal(response.status, 400, tmdbId);
      assert.equal(await readErrorCode(response), 'invalid_input');
    }
    assert.deepEqual(sources.calls, NO_CALLS);
  });

  test('tmdbId também é lido do caminho', async () => {
    assert.equal((await getMovie('/api/movies/2756')).status, 200);
  });

  test('sem token: 401 sem pedidos externos', async () => {
    assert.equal((await getMovie('/api/movies/2756?tmdbId=2756', {})).status, 401);
    assert.deepEqual(sources.calls, NO_CALLS);
  });
});

describe('GET /api/movies/{tmdbId}: cópia resumida nas listas', () => {
  test('com o filme fresco, corrige uma entrada gravada depois com uma cópia diferente', async () => {
    await getAbyss();
    const entry = dependencies.db.doc('lists/L1/entries/E9');
    const fromSearch = { title: 'O Segredo do Abismo', year: 1989, posterPath: null, imdb: null, letterboxd: null };
    await entry.set({ tmdbId: 2756, movie: fromSearch });
    forgetCalls();

    await getAbyss();

    assert.deepEqual(sources.calls, NO_CALLS);
    assert.equal((await entry.get()).get('movie.title'), 'The Abyss');
  });

  test('atualiza as entradas desse filme em qualquer lista e não mexe nas outras', async () => {
    const outdated = { title: 'The Abyss', year: 1989, posterPath: null, imdb: 7.0, letterboxd: null };
    const entry = (path: string) => dependencies.db.doc(path);
    await entry('lists/L1/entries/E1').set({ tmdbId: 2756, movie: outdated });
    await entry('lists/L2/entries/E2').set({ tmdbId: 2756, movie: outdated });
    await entry('lists/L1/entries/E3').set({ tmdbId: 603, movie: { ...outdated, title: 'The Matrix' } });

    await getAbyss();

    const updated = (await entry('lists/L1/entries/E1').get()).get('movie');
    assert.deepEqual(
      { imdb: updated.imdb, letterboxd: updated.letterboxd, year: updated.year, directors: updated.directors },
      { imdb: 7.5, letterboxd: 3.72, year: 1989, directors: [{ id: 2710, name: 'James Cameron' }] },
    );
    assert.deepEqual((await entry('lists/L2/entries/E2').get()).get('movie'), updated);
    assert.equal((await entry('lists/L1/entries/E3').get()).get('movie.title'), 'The Matrix');
  });
});

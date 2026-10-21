import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { enrichCronRoute } from '../../api/cron/_enrich.js';
import { runEnrich } from '../../lib/enrich/run-enrich.js';
import { withoutUndefined } from '../../lib/firestore/without-undefined.js';
import { getFreshMovie } from '../../lib/movies/get-fresh-movie.js';
import { mergeMovie } from '../../lib/movies/merge-movie.js';
import { findMovie } from '../../lib/movies/movie-repository.js';
import { findPerson } from '../../lib/people/person-repository.js';
import { DAY_MS } from '../../lib/time/durations.js';
import type { EnrichLimits, EnrichReport } from '../../lib/types/enrich.js';
import type { Movie } from '../../lib/types/movie.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies, TEST_CRON_SECRET } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';
import { tmdbAbyss } from '../support/movie-samples.js';
import { getRequest, readErrorCode } from '../support/requests.js';
import { type FakeWikimedia, fakeWikimedia } from './fake-wikimedia.js';

const LIMITS: EnrichLimits = { budgetMs: 240_000, batchSize: 20, omdbCalls: 100 };

let sources: FakeSources;
let wikimedia: FakeWikimedia;
let clock: Date;
let dependencies: ReturnType<typeof createTestDependencies>;

beforeEach(async () => {
  await resetEmulators();
  sources = fakeSources();
  wikimedia = fakeWikimedia(sources.fetch);
  clock = new Date('2026-10-16T07:00:00Z');
  dependencies = createTestDependencies(wikimedia.fetch, () => clock);
});

const run = (limits: EnrichLimits = LIMITS) => runEnrich(dependencies, new UsageMeter(), limits);
const doc = (path: string) => dependencies.db.doc(path);
const forgetCalls = () => {
  Object.assign(sources.calls, { tmdb: 0, omdb: 0, letterboxd: 0, bechdel: 0 });
  Object.assign(wikimedia.calls, { wikidata: 0, wikipedia: 0 });
};
const allCalls = () => ({
  tmdb: sources.calls.tmdb,
  omdb: sources.calls.omdb,
  letterboxd: sources.calls.letterboxd,
  wikidata: wikimedia.calls.wikidata,
  wikipedia: wikimedia.calls.wikipedia,
});

/**
 * Grava movies/603 já completo e fresco: dirigido por James Cameron (2710), com Michael Biehn (2712)
 * no elenco, sem id do IMDb, para fazer os dois recorrentes junto com The Abyss.
 *
 * @param overrides - Campos a trocar (por exemplo, sem prêmios).
 * @returns O documento gravado.
 */
async function seedFreshMovie(overrides: Partial<Movie> = {}): Promise<Movie> {
  const movie: Movie = {
    ...mergeMovie(
      undefined,
      {
        tmdb: {
          ...tmdbAbyss,
          title: 'Filme de teste',
          imdbId: null,
          directors: [{ id: 2710, name: 'James Cameron', profilePath: null }],
          cast: [{ id: 2712, name: 'Michael Biehn', character: null, profilePath: null }],
        },
      },
      clock,
    ),
    keywords: [],
    providersBR: { flatrate: [], previous: [], fetchedAt: clock },
    extraFetchedAt: clock,
    streamingFirst: false,
    trailer: null,
    awards: { items: [], summary: null, fetchedAt: clock },
    ...overrides,
  };
  // `awards: undefined` nos overrides tira o campo (o Firestore recusa undefined).
  await doc('movies/603').set(withoutUndefined(movie));
  return movie;
}

/** Põe The Abyss e o filme 603 na lista L1. */
async function seedList(): Promise<void> {
  await doc('lists/L1/entries/e1').set({ tmdbId: 2756 });
  await doc('lists/L1/entries/e2').set({ tmdbId: 603 });
}

describe('GET /api/cron/enrich', () => {
  test('sem o segredo do cron: 401', async () => {
    const response = await enrichCronRoute(() => dependencies)(getRequest('/api/cron/enrich'));
    assert.equal(response.status, 401);
    assert.equal(await readErrorCode(response), 'unauthenticated');
  });

  test('com o segredo: 200 com o relatório', async () => {
    const response = await enrichCronRoute(() => dependencies)(
      getRequest('/api/cron/enrich', { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }),
    );
    const report = (await response.json()) as EnrichReport;

    assert.equal(response.status, 200);
    assert.equal(report.finished, true);
    assert.equal(report.day, '2026-10-16');
  });
});

describe('rotina enrich: filmes e pessoas', () => {
  test('busca campos extras e prêmios do filme vencido e grava as pessoas recorrentes', async () => {
    await seedFreshMovie();
    await seedList();

    const report = await run();

    assert.deepEqual(report.movies, { updated: 1, failed: 0 });
    assert.deepEqual(report.people, { updated: 2, failed: 0 });
    assert.equal(report.finished, true);
    // TMDb: The Abyss e as duas pessoas; Wikidata: uma consulta de filmes e uma de pessoas.
    assert.deepEqual(allCalls(), { tmdb: 3, omdb: 1, letterboxd: 0, wikidata: 2, wikipedia: 1 });

    const abyss = await findMovie(dependencies.db, 2756);
    assert.equal(abyss?.titlePt, 'O Segredo do Abismo');
    assert.ok((abyss?.keywords?.length ?? 0) > 0 && (abyss?.recs?.length ?? 0) > 0);
    assert.deepEqual(abyss?.providersBR?.flatrate, ['Disney Plus']);
    assert.equal(abyss?.backdropPath, '/mW6XzxelLY8T2oW2NjciG9LpZT5.jpg');
    assert.equal(abyss?.trailer?.key, '7cCVYAcIIAo');
    assert.equal(abyss?.extraFetchedAt?.getTime(), clock.getTime());
    assert.equal(abyss?.boxOfficeUS, 54_981_151);
    assert.equal(abyss?.awards?.summary, 'Ganhou 1 Oscar. 9 prêmios e 16 indicações no total');
    assert.deepEqual(abyss?.awards?.items[0], {
      org: 'Oscar',
      cat: 'melhores efeitos visuais',
      kind: 'win',
      year: 1990,
    });

    const cameron = await findPerson(dependencies.db, 2710);
    assert.ok(cameron?.awards?.items.some((item) => item.org === 'Oscar' && item.kind === 'win'));
    assert.deepEqual((await findPerson(dependencies.db, 2712))?.awards?.items, []);
    assert.equal((await doc('jobs/enrich').get()).get('phase'), 'done');
  });

  test('filme fresco gravado antes do trailer existir conta como vencido', async () => {
    await seedFreshMovie({ trailer: undefined });
    await seedList();

    const report = await run();

    // O 603 entra na busca (e o TMDb falso não o tem); com `trailer: null`, ficaria de fora.
    assert.deepEqual(report.movies, { updated: 1, failed: 1 });
  });

  test('rodada duas vezes no mesmo dia: a segunda não pede nada nem grava nada', async () => {
    await seedFreshMovie();
    await seedList();
    await run();
    const before = await Promise.all(['movies/2756', 'people/2710', 'jobs/enrich'].map((path) => doc(path).get()));
    forgetCalls();
    clock = new Date(clock.getTime() + 60_000);

    const report = await run();

    assert.deepEqual(allCalls(), { tmdb: 0, omdb: 0, letterboxd: 0, wikidata: 0, wikipedia: 0 });
    assert.deepEqual([report.movies.updated, report.people.updated, report.providers.updated], [0, 0, 0]);
    const after = await Promise.all(['movies/2756', 'people/2710', 'jobs/enrich'].map((path) => doc(path).get()));
    assert.deepEqual(
      after.map((snapshot) => snapshot.updateTime?.toMillis()),
      before.map((snapshot) => snapshot.updateTime?.toMillis()),
    );
  });

  test('filme com campos extras frescos e sem prêmios: só os prêmios (sem TMDb)', async () => {
    await getFreshMovie(2756, dependencies, new UsageMeter());
    await doc('lists/L1/entries/e1').set({ tmdbId: 2756 });
    forgetCalls();

    const report = await run();

    assert.deepEqual(report.movies, { updated: 1, failed: 0 });
    // A OMDb volta só para o resumo de prêmios, que ainda não existia.
    assert.deepEqual(allCalls(), { tmdb: 0, omdb: 1, letterboxd: 0, wikidata: 1, wikipedia: 1 });
    assert.equal((await findMovie(dependencies.db, 2756))?.awards?.items.length, 5);
  });

  test('Wikidata fora do ar: grava os campos extras, mantém sem prêmios e tenta de novo na próxima', async () => {
    await doc('lists/L1/entries/e1').set({ tmdbId: 2756 });
    wikimedia.failing.add('wikidata');

    const first = await run();
    assert.deepEqual(first.movies, { updated: 0, failed: 1 });
    const saved = await findMovie(dependencies.db, 2756);
    assert.equal(saved?.titlePt, 'O Segredo do Abismo');
    assert.equal(saved?.awards, undefined);

    wikimedia.failing.clear();
    forgetCalls();
    clock = new Date(clock.getTime() + 60_000);
    const second = await run();

    assert.deepEqual(second.movies, { updated: 1, failed: 0 });
    assert.equal(sources.calls.tmdb, 0);
    assert.ok((await findMovie(dependencies.db, 2756))?.awards);
  });

  test('para pelo tempo com o cursor e continua dali na execução seguinte do mesmo dia', async () => {
    // 603 com campos extras frescos e sem prêmios nem id do IMDb: precisa só do Wikidata.
    await seedFreshMovie({ awards: undefined });
    await seedList();
    // Cada leitura do relógio avança 100 s: o lote do 603 passa, o do 2756 já encontra o tempo esgotado.
    let ticks = 0;
    const start = clock.getTime();
    dependencies = createTestDependencies(wikimedia.fetch, () => new Date(start + 100_000 * ticks++));

    const first = await run({ budgetMs: 150_000, batchSize: 1, omdbCalls: 100 });

    assert.equal(first.finished, false);
    assert.deepEqual(first.movies, { updated: 1, failed: 0 });
    const cursor = (await doc('jobs/enrich').get()).data();
    assert.deepEqual([cursor?.phase, cursor?.after, cursor?.day], ['movies', 603, '2026-10-16']);
    assert.equal((await findMovie(dependencies.db, 2756))?.extraFetchedAt, undefined);

    const second = await run({ budgetMs: 10 * DAY_MS, batchSize: 1, omdbCalls: 100 });

    assert.deepEqual(second.resumedFrom, { phase: 'movies', after: 603 });
    assert.equal(second.finished, true);
    assert.deepEqual(second.movies, { updated: 1, failed: 0 });
    assert.ok((await findMovie(dependencies.db, 2756))?.extraFetchedAt);
  });

  test('para pela cota da OMDb da execução', async () => {
    await seedFreshMovie({ awards: undefined, ids: { imdb: 'tt0133093', letterboxd: null } });
    await seedList();

    const report = await run({ ...LIMITS, omdbCalls: 1 });

    assert.equal(report.finished, false);
    assert.equal(sources.calls.omdb, 1);
    assert.equal((await doc('jobs/enrich').get()).get('after'), 603);
  });
});

describe('rotina enrich: onde assistir da fila', () => {
  test('busca de novo quem não foi buscado hoje e guarda o anterior em previous', async () => {
    await getFreshMovie(2756, dependencies, new UsageMeter());
    const yesterday = new Date(clock.getTime() - DAY_MS);
    await doc('movies/2756').update({
      providersBR: { flatrate: ['Netflix'], previous: ['Netflix'], fetchedAt: yesterday },
      awards: { items: [], summary: null, fetchedAt: clock },
    });
    await doc('lists/L1/queue/2756').set({ tmdbId: 2756, addedBy: 'u1', createdAt: clock });
    forgetCalls();

    const report = await run();

    assert.deepEqual(report.providers, { updated: 1, failed: 0 });
    assert.deepEqual(report.movies, { updated: 0, failed: 0 });
    assert.deepEqual(allCalls(), { tmdb: 1, omdb: 0, letterboxd: 0, wikidata: 0, wikipedia: 0 });
    const providers = (await findMovie(dependencies.db, 2756))?.providersBR;
    assert.deepEqual([providers?.flatrate, providers?.previous], [['Disney Plus'], ['Netflix']]);

    // No mesmo dia, a fila não é buscada de novo.
    forgetCalls();
    await run();
    assert.equal(sources.calls.tmdb, 0);
  });
});

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { dailyCronRoute } from '../../api/cron/daily.js';
import { runDailyMaintenance } from '../../lib/maintenance/run-daily-maintenance.js';
import { FRESHNESS_MS } from '../../lib/movies/freshness.js';
import { getFreshMovie } from '../../lib/movies/get-fresh-movie.js';
import { getFreshPerson } from '../../lib/people/get-fresh-person.js';
import { PERSON_FRESHNESS_MS } from '../../lib/people/person-freshness.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies, TEST_CRON_SECRET } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';
import { getRequest, readErrorCode } from '../support/requests.js';

type Report = {
  movies: { refreshed: number; failed: number };
  people: { refreshed: number; failed: number };
  invitesDeleted: number;
};

const NO_CALLS = { tmdb: 0, omdb: 0, letterboxd: 0 };

let sources: FakeSources;
let clock: Date;
let dependencies: ReturnType<typeof createTestDependencies>;

beforeEach(async () => {
  await resetEmulators();
  sources = fakeSources();
  clock = new Date('2026-10-16T09:00:00Z');
  dependencies = createTestDependencies(sources.fetch, () => clock);
});

const runCron = (authorization?: string) =>
  dailyCronRoute(() => dependencies)(
    getRequest('/api/cron/daily', authorization ? { headers: { authorization } } : {}),
  );
const runAsVercel = async () => (await (await runCron(`Bearer ${TEST_CRON_SECRET}`)).json()) as Report;
const advanceClock = (ms: number) => {
  clock = new Date(clock.getTime() + ms);
};
const forgetCalls = () => Object.assign(sources.calls, NO_CALLS);

describe('GET /api/cron/daily: acesso', () => {
  test('sem o segredo ou com segredo errado: 401 sem fazer nada', async () => {
    await getFreshMovie(2756, dependencies, new UsageMeter());
    advanceClock(FRESHNESS_MS);
    forgetCalls();

    for (const authorization of [undefined, 'Bearer errado', TEST_CRON_SECRET]) {
      const response = await runCron(authorization);
      assert.equal(response.status, 401);
      assert.equal(await readErrorCode(response), 'unauthenticated');
    }
    assert.deepEqual(sources.calls, NO_CALLS);
  });
});

describe('GET /api/cron/daily: filmes', () => {
  test('nota com mais de 7 dias é atualizada; filme fresco não é tocado', async () => {
    await getFreshMovie(2756, dependencies, new UsageMeter());
    forgetCalls();

    const fresh = await runAsVercel();
    assert.deepEqual(fresh.movies, { refreshed: 0, failed: 0 });
    assert.deepEqual(sources.calls, NO_CALLS);

    advanceClock(FRESHNESS_MS);
    const stale = await runAsVercel();

    assert.deepEqual(stale.movies, { refreshed: 1, failed: 0 });
    assert.deepEqual(sources.calls, { tmdb: 1, omdb: 1, letterboxd: 1 });
    const saved = (await dependencies.db.doc('movies/2756').get()).data();
    assert.equal(saved?.ratings.imdb.fetchedAt.toDate().toISOString(), clock.toISOString());
  });

  test('respeita o limite por execução, começando pelo que está há mais tempo sem busca', async () => {
    await getFreshMovie(2756, dependencies, new UsageMeter());
    const abyss = (await dependencies.db.doc('movies/2756').get()).data() ?? {};
    // Duas cópias guardadas há mais tempo; o TMDb falso não as conhece (responde 404), mas com
    // documento guardado a falha só mantém o que havia.
    await dependencies.db.doc('movies/11').set({ ...abyss, tmdbFetchedAt: new Date(clock.getTime() - 1000) });
    await dependencies.db.doc('movies/12').set({ ...abyss, tmdbFetchedAt: new Date(clock.getTime() - 2000) });
    advanceClock(FRESHNESS_MS);
    forgetCalls();

    const report = await runDailyMaintenance(dependencies, new UsageMeter(), { movies: 2, people: 0 });

    assert.deepEqual(report.movies, { refreshed: 2, failed: 0 });
    assert.equal(sources.calls.tmdb, 2);
    assert.equal(
      (await dependencies.db.doc('movies/2756').get()).get('tmdbFetchedAt').toDate().getTime(),
      clock.getTime() - FRESHNESS_MS,
    );
  });
});

describe('GET /api/cron/daily: pessoas e convites', () => {
  test('pessoa com mais de 30 dias é atualizada', async () => {
    await getFreshPerson(2710, dependencies, new UsageMeter());
    advanceClock(PERSON_FRESHNESS_MS);
    forgetCalls();

    const report = await runAsVercel();

    assert.deepEqual(report.people, { refreshed: 1, failed: 0 });
    assert.equal(sources.calls.tmdb, 1);
  });

  test('documento fora do formato é pulado sem derrubar a rotina', async () => {
    await dependencies.db.doc('movies/999').set({ title: 'Quebrado' });
    await dependencies.db.doc('people/999').set({ name: 'Quebrada' });
    await dependencies.db
      .collection('invites')
      .doc('VENCID')
      .set({
        listId: 'L1',
        createdBy: 'u',
        expiresAt: new Date(clock.getTime() - 1),
        usedBy: [],
      });

    const response = await runCron(`Bearer ${TEST_CRON_SECRET}`);

    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as Report).invitesDeleted, 1);
  });

  test('código vencido some; código válido fica', async () => {
    const invites = dependencies.db.collection('invites');
    await invites
      .doc('VENCID')
      .set({ listId: 'L1', createdBy: 'u', expiresAt: new Date(clock.getTime() - 1), usedBy: [] });
    await invites
      .doc('VALIDO')
      .set({ listId: 'L1', createdBy: 'u', expiresAt: new Date(clock.getTime() + 1), usedBy: [] });

    const report = await runAsVercel();

    assert.equal(report.invitesDeleted, 1);
    assert.equal((await invites.doc('VENCID').get()).exists, false);
    assert.equal((await invites.doc('VALIDO').get()).exists, true);
  });
});

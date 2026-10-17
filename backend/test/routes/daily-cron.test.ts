import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { dailyCronRoute } from '../../api/cron/daily.js';
import { NOT_FOUND_FRESHNESS_MS } from '../../lib/bechdel/bechdel-freshness.js';
import { runDailyMaintenance } from '../../lib/maintenance/run-daily-maintenance.js';
import { FRESHNESS_MS } from '../../lib/movies/freshness.js';
import { getFreshMovie } from '../../lib/movies/get-fresh-movie.js';
import { getFreshPerson } from '../../lib/people/get-fresh-person.js';
import { PERSON_FRESHNESS_MS } from '../../lib/people/person-freshness.js';
import { usageDay } from '../../lib/usage/usage-day.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies, TEST_CRON_SECRET } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';
import { getRequest, readErrorCode } from '../support/requests.js';

type Report = {
  movies: { refreshed: number; failed: number };
  bechdel: { updated: number; matched: number; notFound: number; failed: number };
  invitesDeleted: number;
};

const NO_CALLS = { tmdb: 0, omdb: 0, letterboxd: 0, bechdel: 0 };
/** Com algum filme casado com o bechdeltest.com, toda execução baixa o índice uma vez. */
const ONLY_BECHDEL_INDEX = { ...NO_CALLS, bechdel: 1 };

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
  test('nota com mais de 7 dias é atualizada sem buscar o TMDb; filme fresco não é tocado', async () => {
    await getFreshMovie(2756, dependencies, new UsageMeter());
    forgetCalls();

    const fresh = await runAsVercel();
    assert.deepEqual(fresh.movies, { refreshed: 0, failed: 0 });
    assert.deepEqual(sources.calls, ONLY_BECHDEL_INDEX);

    advanceClock(FRESHNESS_MS);
    const stale = await runAsVercel();

    assert.deepEqual(stale.movies, { refreshed: 1, failed: 0 });
    assert.deepEqual(sources.calls, { tmdb: 0, omdb: 1, letterboxd: 1, bechdel: 2 });
    const saved = (await dependencies.db.doc('movies/2756').get()).data();
    assert.equal(saved?.ratings.imdb.fetchedAt.toDate().toISOString(), clock.toISOString());
  });

  test('filme sem a foto dos diretores, com notas frescas, não é tocado pela rotina', async () => {
    await getFreshMovie(2756, dependencies, new UsageMeter());
    await dependencies.db.doc('movies/2756').update({ directors: [{ id: 2710, name: 'James Cameron' }] });
    forgetCalls();

    const report = await runAsVercel();

    assert.deepEqual(report.movies, { refreshed: 0, failed: 0 });
    assert.deepEqual(sources.calls, ONLY_BECHDEL_INDEX);
  });

  test('respeita o limite por execução, começando pela nota há mais tempo sem busca', async () => {
    await getFreshMovie(2756, dependencies, new UsageMeter());
    const abyss = (await dependencies.db.doc('movies/2756').get()).data() ?? {};
    // Duas cópias com a nota do Letterboxd mais antiga; o Letterboxd falso não as conhece (404), mas
    // com documento guardado a falha só mantém o que havia.
    const olderLetterboxd = (ms: number) => ({
      ...abyss,
      ratings: {
        ...abyss.ratings,
        letterboxd: { ...abyss.ratings.letterboxd, fetchedAt: new Date(clock.getTime() - ms) },
      },
    });
    await dependencies.db.doc('movies/11').set(olderLetterboxd(1000));
    await dependencies.db.doc('movies/12').set(olderLetterboxd(2000));
    advanceClock(FRESHNESS_MS);
    forgetCalls();

    const report = await runDailyMaintenance(dependencies, new UsageMeter(), { movies: 2, bechdelMatches: 30 });

    assert.deepEqual(report.movies, { refreshed: 2, failed: 0 });
    assert.deepEqual(sources.calls, { tmdb: 0, omdb: 2, letterboxd: 2, bechdel: 1 });
    assert.equal(
      (await dependencies.db.doc('movies/2756').get()).get('ratings.letterboxd.fetchedAt').toDate().getTime(),
      clock.getTime() - FRESHNESS_MS,
    );
  });
});

describe('GET /api/cron/daily: pessoas e convites', () => {
  test('pessoas não são atualizadas, nem com mais de 30 dias', async () => {
    await getFreshPerson(2710, dependencies, new UsageMeter());
    advanceClock(PERSON_FRESHNESS_MS);
    forgetCalls();

    const report = await runAsVercel();

    assert.equal('people' in report, false);
    assert.deepEqual(sources.calls, NO_CALLS);
  });

  test('documento fora do formato é pulado sem derrubar a rotina', async () => {
    await dependencies.db.doc('movies/999').set({ title: 'Quebrado' });
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

describe('GET /api/cron/daily: Teste de Bechdel', () => {
  /**
   * Grava The Abyss sem o Teste de Bechdel (só TMDb e notas) e devolve o documento, para os testes
   * fazerem cópias com outros ids.
   *
   * @returns Os dados de movies/2756.
   */
  const storeAbyssWithoutBechdel = async () => {
    await getFreshMovie(2756, dependencies, new UsageMeter(), { ratingsOnly: true });
    forgetCalls();
    return (await dependencies.db.doc('movies/2756').get()).data() ?? {};
  };

  test('baixa o índice uma vez e casa vários filmes, sem nenhum pedido ao TMDb', async () => {
    const abyss = await storeAbyssWithoutBechdel();
    await dependencies.db.doc('movies/11').set(abyss);
    await dependencies.db.doc('movies/12').set(abyss);

    const report = await runAsVercel();

    assert.deepEqual(report.bechdel, { updated: 0, matched: 3, notFound: 0, failed: 0 });
    // Um índice e, para cada filme, o redirecionamento e a página.
    assert.deepEqual(sources.calls, { ...NO_CALLS, bechdel: 1 + 3 * 2 });
    const saved = (await dependencies.db.doc('movies/12').get()).get('bechdel');
    assert.equal(saved.siteId, 1478);
    assert.equal(saved.fetchedAt.toDate().toISOString(), clock.toISOString());
  });

  test('nota alterada no site é atualizada pelo índice, sem pedido por filme', async () => {
    const abyss = await storeAbyssWithoutBechdel();
    const pageReadAt = new Date(clock.getTime() - 1000);
    const outdated = {
      siteId: 1478,
      url: 'https://bechdeltest.com/view/1478/the_abyss/',
      rating: 1,
      dubious: true,
      disputes: 1,
      fetchedAt: pageReadAt,
    };
    await dependencies.db.doc('movies/2756').set({ ...abyss, bechdel: outdated });
    await dependencies.db.doc('movies/11').set({ ...abyss, bechdel: { ...outdated, rating: 3, dubious: false } });

    const report = await runAsVercel();

    assert.deepEqual(report.bechdel, { updated: 1, matched: 0, notFound: 0, failed: 0 });
    assert.deepEqual(sources.calls, ONLY_BECHDEL_INDEX);
    const saved = (await dependencies.db.doc('movies/2756').get()).get('bechdel');
    assert.deepEqual(
      { rating: saved.rating, dubious: saved.dubious, fetchedAt: saved.fetchedAt.toDate().getTime() },
      { rating: 3, dubious: false, fetchedAt: pageReadAt.getTime() },
    );
  });

  test('casa no máximo 30 filmes novos por execução', async () => {
    const abyss = await storeAbyssWithoutBechdel();
    // Sem id do IMDb, nenhum confirma: viram "fora do site" sem pedir páginas.
    const withoutImdb = { ...abyss, ids: { ...abyss.ids, imdb: null } };
    for (let id = 1; id <= 32; id++) await dependencies.db.doc(`movies/${100 + id}`).set(withoutImdb);
    await dependencies.db.doc('movies/2756').delete();

    const report = await runAsVercel();

    assert.deepEqual(report.bechdel, { updated: 0, matched: 0, notFound: 30, failed: 0 });
    assert.deepEqual(sources.calls, ONLY_BECHDEL_INDEX);
    const movies = await dependencies.db.collection('movies').get();
    assert.equal(movies.docs.filter((doc) => doc.get('bechdel') === undefined).length, 2);
  });

  test('fora do site há menos de 7 dias: não é procurado, e sem nada a fazer o índice nem é baixado', async () => {
    const abyss = await storeAbyssWithoutBechdel();
    const notFound = { siteId: null, url: null, rating: null, dubious: false, disputes: 0 };
    const searchedAt = (ms: number) => ({ ...notFound, fetchedAt: new Date(clock.getTime() - ms) });
    await dependencies.db.doc('movies/2756').set({ ...abyss, bechdel: searchedAt(NOT_FOUND_FRESHNESS_MS - 1) });

    const recent = await runAsVercel();
    assert.deepEqual(recent.bechdel, { updated: 0, matched: 0, notFound: 0, failed: 0 });
    assert.deepEqual(sources.calls, NO_CALLS);

    await dependencies.db.doc('movies/2756').update({ bechdel: searchedAt(NOT_FOUND_FRESHNESS_MS) });
    const due = await runAsVercel();
    assert.deepEqual(due.bechdel, { updated: 0, matched: 1, notFound: 0, failed: 0 });
  });

  test('site fora do ar: a rotina segue, o erro é contado e nada é gravado', async () => {
    await storeAbyssWithoutBechdel();
    sources.failing.add('bechdel');

    const response = await runCron(`Bearer ${TEST_CRON_SECRET}`);
    const report = (await response.json()) as Report;

    assert.equal(response.status, 200);
    assert.deepEqual(report.bechdel, { updated: 0, matched: 0, notFound: 0, failed: 1 });
    assert.equal((await dependencies.db.doc('movies/2756').get()).get('bechdel'), undefined);
    const usage = (await dependencies.db.doc(`usage/${usageDay(clock)}`).get()).data();
    assert.deepEqual(usage?.bechdel, { calls: 1, errors: 1 });
  });
});

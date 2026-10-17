import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { personRoute } from '../../api/people/[personId].js';
import { PERSON_FRESHNESS_MS } from '../../lib/people/person-freshness.js';
import { usageDay } from '../../lib/usage/usage-day.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';
import { getRequest, readErrorCode, withBearer } from '../support/requests.js';

type PersonBody = { personId: number; name: string; bioLang: string; directedCount: number; fetchedAt: string };

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

const getPerson = (personId = '2710', init: RequestInit = withBearer(idToken)) =>
  personRoute(() => dependencies)(getRequest(`/api/people/${personId}?personId=${personId}`, init));
const readPerson = async (response: Response) => (await response.json()) as PersonBody;
const advanceClock = (ms: number) => {
  clock = new Date(clock.getTime() + ms);
};
const tmdbUsageToday = async () => (await dependencies.db.doc(`usage/${usageDay(clock)}`).get()).get('tmdb');

describe('GET /api/people/{personId}', () => {
  test('James Cameron vem com biografia, nascimento, foto e filmes dirigidos, e fica gravado', async () => {
    const response = await getPerson();
    const person = await readPerson(response);

    assert.equal(response.status, 200);
    assert.deepEqual(
      [person.personId, person.name, person.bioLang, person.directedCount],
      [2710, 'James Cameron', 'pt', 21],
    );
    assert.equal(person.fetchedAt, clock.toISOString());
    assert.equal((await dependencies.db.doc('people/2710').get()).exists, true);
    assert.deepEqual(await tmdbUsageToday(), { calls: 1 });
  });

  test('segunda chamada no mesmo mês não pede ao TMDb', async () => {
    await getPerson();
    advanceClock(PERSON_FRESHNESS_MS - 1000);

    await getPerson();

    assert.equal(sources.calls.tmdb, 1);
    // O relógio andou quase 30 dias: o consumo deste pedido cai no documento do novo dia.
    assert.deepEqual(await tmdbUsageToday(), { cacheHits: 1 });
  });

  test('depois de 30 dias busca de novo', async () => {
    await getPerson();
    advanceClock(PERSON_FRESHNESS_MS);

    await getPerson();

    assert.equal(sources.calls.tmdb, 2);
  });

  test('TMDb fora do ar com pessoa guardada: devolve a guardada, com a data dela', async () => {
    const firstFetch = clock.toISOString();
    await getPerson();
    advanceClock(PERSON_FRESHNESS_MS);
    sources.failing.add('tmdb');

    const person = await readPerson(await getPerson());

    assert.equal(person.name, 'James Cameron');
    assert.equal(person.fetchedAt, firstFetch);
  });

  test('TMDb fora do ar sem pessoa guardada: 502', async () => {
    sources.failing.add('tmdb');
    const response = await getPerson();
    assert.equal(response.status, 502);
    assert.equal(await readErrorCode(response), 'source_unavailable');
  });

  test('Michael Biehn vem com os filmes em que atuou, incluindo The Abyss e Aliens', async () => {
    const response = await getPerson('2712');
    const biehn = (await response.json()) as PersonBody & { acted: { title: string; character: string | null }[] };

    assert.equal(response.status, 200);
    assert.equal(biehn.name, 'Michael Biehn');
    assert.ok(['The Abyss', 'Aliens'].every((title) => biehn.acted.some((movie) => movie.title === title)));
  });

  test('pessoa inexistente: 404; personId inválido: 400; sem token: 401', async () => {
    assert.equal((await getPerson('99999999')).status, 404);
    assert.equal((await getPerson('abc')).status, 400);
    assert.equal((await getPerson('0')).status, 400);
    assert.equal((await getPerson('2710', {})).status, 401);
  });
});

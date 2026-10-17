import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { searchRoute } from '../../api/search/index.js';
import { searchPeopleRoute } from '../../api/search/people.js';
import { usageDay } from '../../lib/usage/usage-day.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';
import { getRequest, readErrorCode, withBearer } from '../support/requests.js';

type PeopleBody = { results: { personId: number; name: string; department: string; knownFor: string[] }[] };

let sources: FakeSources;
let dependencies: ReturnType<typeof createTestDependencies>;
let idToken: string;

beforeEach(async () => {
  await resetEmulators();
  sources = fakeSources();
  dependencies = createTestDependencies(sources.fetch);
  ({ idToken } = await signUp('pessoa@exemplo.com'));
});

const searchPeople = (query: string, init: RequestInit = withBearer(idToken)) =>
  searchPeopleRoute(() => dependencies)(getRequest(`/api/search/people?q=${encodeURIComponent(query)}`, init));
const tmdbUsageToday = async () => (await dependencies.db.doc(`usage/${usageDay(new Date())}`).get()).get('tmdb');

describe('GET /api/search/people', () => {
  test('"cameron" lista James Cameron como direção', async () => {
    const response = await searchPeople('cameron');
    const { results } = (await response.json()) as PeopleBody;

    assert.equal(response.status, 200);
    assert.ok(results.some((person) => person.personId === 2710 && person.department === 'directing'));
    assert.deepEqual(Object.keys(results[0] ?? {}).sort(), [
      'department',
      'knownFor',
      'name',
      'personId',
      'profilePath',
    ]);
    assert.deepEqual(await tmdbUsageToday(), { calls: 1 });
  });

  test('"ed harris" lista Ed Harris como atuação, em primeiro', async () => {
    const { results } = (await (await searchPeople('ed harris')).json()) as PeopleBody;
    assert.deepEqual([results[0]?.personId, results[0]?.department], [228, 'acting']);
  });

  test('termo com menos de 2 letras ou mais de 100: 400 sem pedir ao TMDb; sem token: 401', async () => {
    for (const query of ['a', ' a ', 'a'.repeat(101)]) {
      const response = await searchPeople(query);
      assert.equal(response.status, 400, query);
      assert.equal(await readErrorCode(response), 'invalid_input');
    }
    assert.equal((await searchPeople('cameron', {})).status, 401);
    assert.equal(sources.calls.tmdb, 0);
  });

  test('TMDb fora do ar: 502 e o erro é contado', async () => {
    sources.failing.add('tmdb');
    const response = await searchPeople('cameron');
    assert.equal(response.status, 502);
    assert.deepEqual(await tmdbUsageToday(), { calls: 1, errors: 1 });
  });

  test('a busca de filmes continua respondendo igual', async () => {
    const response = await searchRoute(() => dependencies)(getRequest('/api/search?q=abismo', withBearer(idToken)));
    const { results } = (await response.json()) as { results: { tmdbId: number; title: string }[] };
    assert.equal(response.status, 200);
    assert.ok(results.some((movie) => movie.tmdbId === 2756 && movie.title === 'O Segredo do Abismo'));
  });
});

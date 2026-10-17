import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { searchRoute } from '../../api/search/index.js';
import { usageDay } from '../../lib/usage/usage-day.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';
import { getRequest, readErrorCode, withBearer } from '../support/requests.js';

type SearchBody = { results: Record<string, unknown>[] };

let sources: FakeSources;
let dependencies: ReturnType<typeof createTestDependencies>;
let idToken: string;

beforeEach(async () => {
  await resetEmulators();
  sources = fakeSources();
  dependencies = createTestDependencies(sources.fetch);
  ({ idToken } = await signUp('pessoa@exemplo.com'));
});

const search = (query: string, init: RequestInit = withBearer(idToken)) =>
  searchRoute(() => dependencies)(getRequest(`/api/search?q=${encodeURIComponent(query)}`, init));
const tmdbUsageToday = async () => (await dependencies.db.doc(`usage/${usageDay(new Date())}`).get()).get('tmdb');

describe('GET /api/search', () => {
  test('devolve resultados resumidos e conta um pedido ao TMDb', async () => {
    const response = await search('abismo');
    const { results } = (await response.json()) as SearchBody;

    assert.equal(response.status, 200);
    assert.ok(results.some((r) => r.tmdbId === 2756 && r.title === 'O Segredo do Abismo' && r.year === 1989));
    assert.deepEqual(Object.keys(results[0] ?? {}).sort(), [
      'originalTitle',
      'overview',
      'posterPath',
      'title',
      'tmdbId',
      'year',
    ]);
    assert.deepEqual(await tmdbUsageToday(), { calls: 1 });
  });

  test('q vazio ou com mais de 100 caracteres: 400 sem pedir ao TMDb', async () => {
    for (const query of [' ', 'a'.repeat(101)]) {
      const response = await search(query);
      assert.equal(response.status, 400);
      assert.equal(await readErrorCode(response), 'invalid_input');
    }
    assert.equal(sources.calls.tmdb, 0);
  });

  test('sem token: 401 sem pedir ao TMDb', async () => {
    assert.equal((await search('abismo', {})).status, 401);
    assert.equal(sources.calls.tmdb, 0);
  });

  test('TMDb fora do ar: 502 e o erro é contado', async () => {
    sources.failing.add('tmdb');
    const response = await search('abismo');

    assert.equal(response.status, 502);
    assert.equal(await readErrorCode(response), 'source_unavailable');
    assert.deepEqual(await tmdbUsageToday(), { calls: 1, errors: 1 });
  });
});

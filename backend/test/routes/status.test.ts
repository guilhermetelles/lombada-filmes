import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { statusRoute } from '../../api/_status.js';
import { createListRoute } from '../../api/lists/index.js';
import { recordJobHealth } from '../../lib/jobs/job-health.js';
import { GEMINI_MODELS } from '../../lib/sources/gemini/gemini-models.js';
import type { StatusResponse } from '../../lib/types/status.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';
import { getRequest, jsonRequest, readErrorCode, withBearer } from '../support/requests.js';

type Person = { uid: string; idToken: string };

/** 19/10/2026, 15h de Brasília. */
const clock = new Date('2026-10-19T18:00:00Z');
const dependencies = createTestDependencies(fakeSources().fetch, () => clock);
const withDependencies = () => dependencies;

let ana: Person;
let outsider: Person;

beforeEach(async () => {
  await resetEmulators();
  [ana, outsider] = await Promise.all([signUp('ana@exemplo.com'), signUp('de-fora@exemplo.com')]);
  await createListRoute(withDependencies)(jsonRequest('/api/lists', { name: 'Maratona' }, ana.idToken));
});

const getStatus = (person: Person) =>
  statusRoute(withDependencies)(getRequest('/api/status', withBearer(person.idToken)));

describe('GET /api/status', () => {
  test('saúde das rotinas, consumo dos últimos 7 dias e os modelos do Gemini', async () => {
    await recordJobHealth(dependencies.db, 'recs', {
      lastRunAt: new Date('2026-10-19T08:00:00Z'),
      durationMs: 42_000,
      status: 'partial',
      summary: 'Sugestões de 1 lista; 80 pedidos ao TMDb.',
      warnings: ['motivos das sugestões pela reserva: gemini-3.7-flash: respondeu 429'],
    });
    // Cursor antigo, sem os campos de saúde: fica de fora.
    await dependencies.db.doc('jobs/enrich').set({ day: '2026-10-19', phase: 'done', after: null, updatedAt: clock });
    await dependencies.db.doc('usage/2026-10-19').set({
      tmdb: { calls: 120, errors: 2, cacheHits: 30 },
      omdb: { calls: 10, dailyLimit: 1000 },
      gemini: { calls: 3, errors: 1 },
      geminiModels: { 'gemini-3.8-flash': { calls: 2, errors: 1, quota: 1 }, 'gemini-3.7-flash': { calls: 1 } },
    });
    await dependencies.db.doc('usage/2026-10-13').set({ tmdb: { calls: 5 } });
    await dependencies.db.doc('usage/2026-10-12').set({ tmdb: { calls: 99 } });

    const response = await getStatus(ana);

    assert.equal(response.status, 200);
    const status = (await response.json()) as StatusResponse;
    assert.deepEqual(status.jobs, [
      {
        name: 'recs',
        lastRunAt: '2026-10-19T08:00:00.000Z',
        durationMs: 42_000,
        status: 'partial',
        summary: 'Sugestões de 1 lista; 80 pedidos ao TMDb.',
        warnings: ['motivos das sugestões pela reserva: gemini-3.7-flash: respondeu 429'],
      },
    ]);
    assert.deepEqual(
      status.usage.map((day) => day.day),
      ['2026-10-19', '2026-10-18', '2026-10-17', '2026-10-16', '2026-10-15', '2026-10-14', '2026-10-13'],
    );
    assert.deepEqual(status.usage[0], {
      day: '2026-10-19',
      sources: { tmdb: { calls: 120, errors: 2 }, omdb: { calls: 10, errors: 0 }, gemini: { calls: 3, errors: 1 } },
      geminiModels: {
        'gemini-3.8-flash': { calls: 2, errors: 1, quota: 1 },
        'gemini-3.7-flash': { calls: 1, errors: 0, quota: 0 },
      },
    });
    assert.deepEqual(status.usage[1], { day: '2026-10-18', sources: {}, geminiModels: {} });
    assert.deepEqual(status.usage[6]?.sources, { tmdb: { calls: 5, errors: 0 } });
    assert.deepEqual(status.gemini.interpret, [...GEMINI_MODELS.interpret]);
    assert.deepEqual(status.gemini.text, [...GEMINI_MODELS.text]);
    assert.match(status.gemini.dailyLimitNote, /20 pedidos por dia/);
  });

  test('quem não participa de nenhuma lista: 403; sem token: 401', async () => {
    const response = await getStatus(outsider);
    assert.equal(response.status, 403);
    assert.equal(await readErrorCode(response), 'forbidden');
    assert.equal((await statusRoute(withDependencies)(getRequest('/api/status'))).status, 401);
  });
});

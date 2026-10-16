import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { usageDay } from '../../lib/usage/usage-day.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';

const { db } = createTestDependencies(fakeSources().fetch);
const now = new Date('2026-10-16T15:00:00Z');
const todayDocument = () => db.doc(`usage/${usageDay(now)}`);
const readToday = async () => (await todayDocument().get()).data();

beforeEach(resetEmulators);

describe('usageDay', () => {
  test('usa o fuso de São Paulo', () => {
    assert.equal(usageDay(new Date('2026-10-17T01:30:00Z')), '2026-10-16');
    assert.equal(usageDay(new Date('2026-10-17T03:30:00Z')), '2026-10-17');
  });
});

describe('UsageMeter', () => {
  test('acumula por fonte e soma ao que já estava gravado no dia', async () => {
    await todayDocument().set({ tmdb: { calls: 5 } });
    const usage = new UsageMeter();
    usage.count('tmdb', 'calls');
    usage.count('tmdb', 'calls');
    usage.count('tmdb', 'cacheHits');
    usage.count('letterboxd', 'errors');

    await usage.save(db, now);

    assert.deepEqual(await readToday(), { tmdb: { calls: 7, cacheHits: 1 }, letterboxd: { errors: 1 } });
  });

  test('a OMDb grava a cota diária junto', async () => {
    const usage = new UsageMeter();
    usage.count('omdb', 'calls');

    await usage.save(db, now);

    assert.deepEqual(await readToday(), { omdb: { calls: 1, dailyLimit: 1000 } });
  });

  test('track conta o pedido e, se ele falhar, também o erro', async () => {
    const usage = new UsageMeter();
    const failing = async () => {
      throw new Error('fora do ar');
    };

    assert.equal(await usage.track('tmdb', async () => 'ok'), 'ok');
    await assert.rejects(usage.track('tmdb', failing), /fora do ar/);
    await usage.save(db, now);

    assert.deepEqual(await readToday(), { tmdb: { calls: 2, errors: 1 } });
  });

  test('sem nada contado não grava; depois de gravar, zera', async () => {
    const usage = new UsageMeter();
    await usage.save(db, now);
    assert.equal(await readToday(), undefined);

    usage.count('tmdb', 'calls');
    await usage.save(db, now);
    await usage.save(db, now);

    assert.deepEqual(await readToday(), { tmdb: { calls: 1 } });
  });
});

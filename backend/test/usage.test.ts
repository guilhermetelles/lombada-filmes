import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { db } from '../lib/firestore.js';
import { recordUsage, tracked, usageDay } from '../lib/usage.js';
import { resetEmulators } from './emulators.js';

beforeEach(resetEmulators);

const today = () => db().doc(`usage/${usageDay()}`).get().then((s) => s.data());

test('usageDay usa o fuso de São Paulo', () => {
  assert.equal(usageDay(new Date('2026-10-17T01:30:00Z')), '2026-10-16');
  assert.equal(usageDay(new Date('2026-10-17T03:30:00Z')), '2026-10-17');
});

test('recordUsage soma no documento do dia, por fonte', async () => {
  await recordUsage('tmdb', 'calls');
  await recordUsage('tmdb', 'calls');
  await recordUsage('tmdb', 'cacheHits');
  await recordUsage('letterboxd', 'errors');
  assert.deepEqual(await today(), {
    tmdb: { calls: 2, cacheHits: 1 },
    letterboxd: { errors: 1 },
  });
});

test('omdb grava a cota diária junto', async () => {
  await recordUsage('omdb', 'calls');
  assert.deepEqual(await today(), { omdb: { calls: 1, dailyLimit: 1000 } });
});

test('tracked conta o pedido e, se falhar, o erro', async () => {
  assert.equal(await tracked('tmdb', async () => 'ok'), 'ok');
  await assert.rejects(tracked('tmdb', async () => { throw new Error('fora do ar'); }), /fora do ar/);
  assert.deepEqual(await today(), { tmdb: { calls: 2, errors: 1 } });
});

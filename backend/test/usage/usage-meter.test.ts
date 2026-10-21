import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { usageDay } from '../../lib/usage/usage-day.js';
import { GEMINI_QUOTA_DOC, UsageMeter } from '../../lib/usage/usage-meter.js';
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

  test('conta por modelo do Gemini em geminiModels, sem mexer nos campos das fontes', async () => {
    await todayDocument().set({ gemini: { calls: 1 }, geminiModels: { 'gemini-3.8-flash': { calls: 2 } } });
    const usage = new UsageMeter();
    usage.count('gemini', 'calls');
    usage.countGeminiModel('gemini-3.8-flash', 'calls');
    usage.countGeminiModel('gemini-3.8-flash', 'errors');
    usage.countGeminiModel('gemini-3.8-flash', 'quota');
    usage.countGeminiModel('gemini-3.7-flash', 'calls');

    await usage.save(db, now);

    assert.deepEqual(await readToday(), {
      gemini: { calls: 2 },
      geminiModels: {
        'gemini-3.8-flash': { calls: 3, errors: 1, quota: 1 },
        'gemini-3.7-flash': { calls: 1 },
      },
    });
  });

  test('modelos a pular: os prazos gravados que não passaram e os desta execução', async () => {
    const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
    await db.doc(GEMINI_QUOTA_DOC).set({
      skipUntil: {
        'gemini-3.8-flash': Timestamp.fromDate(later(90)),
        'gemini-3.1-flash-lite': Timestamp.fromDate(later(-1)),
      },
    });
    const usage = new UsageMeter({ db, now: () => now });
    assert.deepEqual([...(await usage.geminiModelsToSkip())], ['gemini-3.8-flash']);

    usage.countGeminiModel('gemini-3.7-flash', 'quota');
    usage.skipGeminiModel('gemini-3.7-flash', later(1));
    assert.deepEqual([...(await usage.geminiModelsToSkip())].sort(), ['gemini-3.7-flash', 'gemini-3.8-flash']);
    assert.deepEqual(usage.geminiQuotaHits(), ['gemini-3.7-flash']);

    // Sem o banco, só vale o que a execução viu.
    assert.deepEqual([...(await new UsageMeter().geminiModelsToSkip())], []);
  });

  test('o prazo de cada modelo vai para quotas/gemini, que atravessa a virada do dia', async () => {
    const until = new Date('2026-10-17T07:00:00Z');
    const usage = new UsageMeter({ db, now: () => now });
    usage.countGeminiModel('gemini-3.8-flash', 'quota');
    usage.skipGeminiModel('gemini-3.8-flash', new Date(now.getTime() + 60_000));
    usage.skipGeminiModel('gemini-3.8-flash', until);
    await usage.save(db, now);

    const stored = (await db.doc(GEMINI_QUOTA_DOC).get()).get('skipUntil');
    assert.equal(stored['gemini-3.8-flash'].toMillis(), until.getTime(), 'vale o prazo mais longo');
    // No dia seguinte, um medidor novo ainda pula o modelo até o prazo gravado.
    const nextDay = new UsageMeter({ db, now: () => new Date('2026-10-17T05:00:00Z') });
    assert.deepEqual([...(await nextDay.geminiModelsToSkip())], ['gemini-3.8-flash']);
  });
});

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { recordJobHealth, runJob } from '../../lib/jobs/job-health.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';

const clock = new Date('2026-10-19T12:00:00Z');
const dependencies = createTestDependencies(fakeSources().fetch, () => clock);
const readJob = async (name: string) => (await dependencies.db.doc(`jobs/${name}`).get()).data();

beforeEach(resetEmulators);

describe('runJob', () => {
  test('grava lastRunAt, durationMs, situação, resumo e avisos, com os modelos do Gemini sem cota', async () => {
    const usage = new UsageMeter();
    const report = await runJob(
      { dependencies, usage },
      'recs',
      async () => {
        usage.countGeminiModel('gemini-3.7-flash', 'quota');
        return { lists: 1 };
      },
      (result) => ({ status: 'partial', summary: `Sugestões de ${result.lists} lista.`, warnings: ['um aviso'] }),
    );

    assert.deepEqual(report, { lists: 1 });
    const job = await readJob('recs');
    assert.equal(job?.lastRunAt.toMillis(), clock.getTime());
    assert.equal(typeof job?.durationMs, 'number');
    assert.deepEqual(
      { status: job?.status, summary: job?.summary, warnings: job?.warnings },
      {
        status: 'partial',
        summary: 'Sugestões de 1 lista.',
        warnings: ['um aviso', 'Gemini sem cota: gemini-3.7-flash'],
      },
    );
  });

  test('rotina que lança: grava failed com o motivo e lança de novo', async () => {
    await assert.rejects(
      runJob(
        { dependencies, usage: new UsageMeter() },
        'daily',
        async () => {
          throw new Error('banco fora do ar');
        },
        () => ({ status: 'ok', summary: '', warnings: [] }),
      ),
      /banco fora do ar/,
    );
    const job = await readJob('daily');
    assert.deepEqual([job?.status, job?.summary], ['failed', 'Falhou: banco fora do ar']);
  });

  test('mantém os outros campos do documento (o cursor de jobs/enrich)', async () => {
    await dependencies.db.doc('jobs/enrich').set({ day: '2026-10-19', phase: 'movies', after: 10, updatedAt: clock });
    await runJob(
      { dependencies, usage: new UsageMeter() },
      'enrich',
      async () => 'feito',
      () => ({ status: 'ok', summary: 'Tudo certo.', warnings: [] }),
    );
    const job = await readJob('enrich');
    assert.deepEqual([job?.phase, job?.after, job?.status], ['movies', 10, 'ok']);
  });
});

describe('recordJobHealth', () => {
  test('no máximo 10 avisos, sem repetidos, e textos cortados', async () => {
    const warnings = [...Array.from({ length: 15 }, (_, index) => `aviso ${index}`), 'aviso 0', 'x'.repeat(300)];
    await recordJobHealth(dependencies.db, 'notify-09', {
      lastRunAt: clock,
      durationMs: 5,
      status: 'ok',
      summary: 'y'.repeat(300),
      warnings,
    });
    const job = await readJob('notify-09');
    assert.equal(job?.warnings.length, 10);
    assert.equal(job?.warnings[0], 'aviso 0');
    assert.ok(job?.summary.length <= 200);
  });

  test('falha ao gravar não lança', async () => {
    const broken = {
      doc: () => ({
        set: async () => {
          throw new Error('sem permissão');
        },
      }),
    } as unknown as Firestore;
    await recordJobHealth(broken, 'daily', {
      lastRunAt: clock,
      durationMs: 1,
      status: 'ok',
      summary: '',
      warnings: [],
    });
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { DailyNotifyReport } from '../../lib/daily/run-daily-notify.js';
import { describeEnrich, describeNotify, describeRecs } from '../../lib/jobs/job-outcomes.js';
import type { ListRecsReport } from '../../lib/recs/compute-list-recs.js';

/** Relatório de uma lista na rotina recs. */
const listReport = (listId: string, reasonsFallback: string | null): ListRecsReport => ({
  listId,
  status: 'written',
  films: 10,
  candidates: 40,
  items: 30,
  trending: 15,
  alpha: 0.5,
  holdoutAccuracy: 0.6,
  geminiReasons: reasonsFallback ? 0 : 45,
  reasonsFallback,
});

describe('resumo das rotinas', () => {
  test('recs: motivos pela reserva viram aviso com a causa e a execução fica parcial', () => {
    const outcome = describeRecs({
      lists: [listReport('l1', 'gemini-3.1-flash-lite: respondeu 429'), listReport('l2', null)],
      failed: [],
      skipped: [],
      tmdbCalls: 120,
    });
    assert.equal(outcome.status, 'partial');
    assert.equal(outcome.summary, 'Sugestões de 2 listas; 120 pedidos ao TMDb.');
    assert.deepEqual(outcome.warnings, ['motivos das sugestões pela reserva: gemini-3.1-flash-lite: respondeu 429']);
  });

  test('recs sem falhas: ok, sem avisos', () => {
    const outcome = describeRecs({ lists: [listReport('l1', null)], failed: [], skipped: [], tmdbCalls: 3 });
    assert.deepEqual([outcome.status, outcome.warnings], ['ok', []]);
  });

  test('enrich que parou pelo tempo: parcial', () => {
    const outcome = describeEnrich({
      day: '2026-10-19',
      resumedFrom: null,
      providers: { updated: 2, failed: 0 },
      movies: { updated: 20, failed: 1 },
      people: { updated: 0, failed: 0 },
      finished: false,
    });
    assert.equal(outcome.status, 'partial');
    assert.equal(outcome.warnings.length, 2);
  });

  test('notify: conta os lembretes do quiz no resumo', () => {
    const report: DailyNotifyReport = {
      hour: 21,
      day: '2026-10-19',
      people: 2,
      sent: 1,
      quizSent: 0,
      quizReminded: 1,
      alreadySent: 0,
      frequency: 0,
      noContent: 0,
      typeOff: 0,
      failed: 0,
      unfinished: 0,
    };
    assert.deepEqual(describeNotify(report), {
      status: 'ok',
      summary: '2 pessoas: 1 assuntos do dia, 0 perguntas do quiz, 1 lembretes do quiz.',
      warnings: [],
    });
  });
});

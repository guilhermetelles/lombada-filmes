import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { brazilDay, brazilMonth, isFirstDayOfMonth, previousMonth } from '../../lib/time/brazil-day.js';

describe('brazilDay', () => {
  test('00:00 UTC ainda é o dia anterior em Brasília (UTC−3)', () => {
    assert.equal(brazilDay(new Date('2026-10-18T00:00:00Z')), '2026-10-17');
    assert.equal(brazilDay(new Date('2026-10-18T02:59:59Z')), '2026-10-17');
    assert.equal(brazilDay(new Date('2026-10-18T03:00:00Z')), '2026-10-18');
  });

  test('a rotina de notificação das 21h (00:00 UTC) conta o dia de Brasília', () => {
    assert.equal(brazilDay(new Date('2027-01-01T00:00:00Z')), '2026-12-31');
  });
});

describe('brazilMonth', () => {
  test('a virada do mês segue o fuso de Brasília', () => {
    assert.equal(brazilMonth(new Date('2026-11-01T02:00:00Z')), '2026-10');
    assert.equal(brazilMonth(new Date('2026-11-01T03:00:00Z')), '2026-11');
  });
});

describe('previousMonth', () => {
  test('volta um mês, e janeiro volta para dezembro do ano anterior', () => {
    assert.equal(previousMonth('2026-10'), '2026-09');
    assert.equal(previousMonth('2026-01'), '2025-12');
    assert.equal(previousMonth('2026-12'), '2026-11');
  });

  test('recusa mês fora do formato', () => {
    assert.throws(() => previousMonth('2026-13'), /mês inválido/);
    assert.throws(() => previousMonth('2026-1'), /mês inválido/);
  });
});

describe('isFirstDayOfMonth', () => {
  test('dia 1 em Brasília, mesmo quando em UTC ainda é o último dia do mês anterior', () => {
    assert.equal(isFirstDayOfMonth(new Date('2026-11-01T08:30:00Z')), true);
    assert.equal(isFirstDayOfMonth(new Date('2026-11-01T02:00:00Z')), false);
    assert.equal(isFirstDayOfMonth(new Date('2026-11-02T03:30:00Z')), false);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addDays, daysBetween, nearestAnniversary } from '../../lib/daily/day-math.js';
import { pickSeeded, seededFraction } from '../../lib/daily/day-seed.js';
import { formatDollars, formatHours, joinPt, monthName } from '../../lib/notify/portuguese-text.js';

describe('contas com dias', () => {
  test('diferença e soma atravessando mês e ano', () => {
    assert.equal(daysBetween('2026-10-18', '2026-10-21'), 3);
    assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
    assert.equal(addDays('2026-10-18', -2), '2026-10-16');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });

  test('aniversário mais próximo, com sinal, e quantos anos completa', () => {
    assert.deepEqual(nearestAnniversary('1989-08-09', '2026-08-10'), { gap: -1, day: '2026-08-09', years: 37 });
    assert.deepEqual(nearestAnniversary('1990-01-02', '2026-12-31'), { gap: 2, day: '2027-01-02', years: 37 });
    assert.deepEqual(nearestAnniversary('1960-10-18', '2026-10-18'), { gap: 0, day: '2026-10-18', years: 66 });
  });
});

describe('sorteio do dia', () => {
  test('a mesma semente dá o mesmo resultado, entre 0 e 1', () => {
    assert.equal(seededFraction('2026-10-18:duelo'), seededFraction('2026-10-18:duelo'));
    for (const seed of ['a', 'b', '2026-10-19:duelo']) {
      const value = seededFraction(seed);
      assert.ok(value >= 0 && value < 1);
    }
    assert.equal(pickSeeded([], 'x'), undefined);
  });
});

describe('textos em português', () => {
  test('dinheiro, horas, listas e meses', () => {
    assert.equal(formatDollars(69_500_000), 'US$ 69,5 milhões');
    assert.equal(formatDollars(1_000_000), 'US$ 1 milhão');
    assert.equal(formatDollars(1_200_000_000), 'US$ 1,2 bilhão');
    assert.equal(formatHours(60), '1 hora');
    assert.equal(formatHours(150), '2,5 horas');
    assert.equal(formatHours(2_220), '37 horas');
    assert.equal(joinPt(['Speed', 'Heat', 'Twister']), 'Speed, Heat e Twister');
    assert.equal(monthName('2026-09'), 'setembro');
  });
});

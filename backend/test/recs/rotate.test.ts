import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addDays } from '../../lib/daily/day-math.js';
import { isOnTurn, rotationPhase, splitByTurn } from '../../lib/recs/rotate.js';

const DAY = '2026-10-27';

/** Ids de teste, de 1000 a 1139. */
const ids = Array.from({ length: 140 }, (_, index) => 1000 + index);

describe('rotação', () => {
  test('cada filme fica na vez em exatamente 2 de 7 dias seguidos, e os 2 são seguidos', () => {
    for (const tmdbId of ids) {
      const days = Array.from({ length: 7 }, (_, offset) => isOnTurn(tmdbId, addDays(DAY, offset)));
      assert.equal(days.filter(Boolean).length, 2, `${tmdbId}`);
      const first = days.indexOf(true);
      assert.ok(days[(first + 1) % 7] || (first === 0 && days[6]), `${tmdbId}`);
    }
  });

  test('ids vizinhos se espalham pelas 7 fases', () => {
    const phases = new Set(ids.slice(0, 30).map(rotationPhase));
    assert.equal(phases.size, 7);
  });

  test('de um dia para o outro sai um grupo de fase e entra outro', () => {
    const onTurn = (day: string) => new Set(ids.filter((tmdbId) => isOnTurn(tmdbId, day)));
    const today = onTurn(DAY);
    const tomorrow = onTurn(addDays(DAY, 1));
    const phasesOf = (set: Set<number>) => new Set([...set].map(rotationPhase));
    assert.equal(phasesOf(today).size, 2);
    assert.equal(phasesOf(tomorrow).size, 2);
    const kept = [...phasesOf(today)].filter((phase) => phasesOf(tomorrow).has(phase));
    assert.equal(kept.length, 1);
  });

  test('só os da vez; com menos de 10, completa com os de maior nota fora da vez', () => {
    const items = ids.map((tmdbId) => ({ tmdbId, score: tmdbId % 100 }));
    const { onTurn, offTurn } = splitByTurn(items, DAY);
    assert.ok(onTurn.length >= 10);
    assert.ok(onTurn.every((item) => isOnTurn(item.tmdbId, DAY)));
    assert.equal(onTurn.length + offTurn.length, items.length);

    const few = items.slice(0, 12);
    const split = splitByTurn(few, DAY);
    assert.equal(split.onTurn.length, Math.max(10, few.filter((item) => isOnTurn(item.tmdbId, DAY)).length));
    const filling = split.onTurn.filter((item) => !isOnTurn(item.tmdbId, DAY));
    const bestOff = Math.max(...split.offTurn.map((item) => item.score), -1);
    for (const item of filling) assert.ok(item.score >= bestOff);
  });

  test('mesma entrada embaralhada dá a mesma ordem', () => {
    const items = ids.map((tmdbId) => ({ tmdbId, score: 50 }));
    const first = splitByTurn(items, DAY).onTurn.map((item) => item.tmdbId);
    const second = splitByTurn([...items].reverse(), DAY).onTurn.map((item) => item.tmdbId);
    assert.deepEqual(first, second);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { generateNKeysBetween } from 'fractional-indexing';
import { duelSwapKeys, type RankedKey } from '../../lib/duel/duel-swap-keys.js';

/**
 * Monta um ranking com chaves em sequência.
 *
 * @param ids - Ids na ordem do ranking.
 * @returns As entradas com chave.
 */
function ranking(ids: string[]): RankedKey[] {
  const keys = generateNKeysBetween(null, null, ids.length);
  return ids.map((entryId, index) => ({ entryId, rankKey: keys[index] ?? '' }));
}

/**
 * Aplica as chaves novas e devolve a ordem resultante.
 *
 * @param entries - Ranking antes.
 * @param keys - Chaves novas.
 * @returns Ids na ordem depois da troca.
 */
function reorder(entries: RankedKey[], keys: Map<string, string>): string[] {
  return entries
    .map((entry) => ({ ...entry, rankKey: keys.get(entry.entryId) ?? entry.rankKey }))
    .sort((a, b) => (a.rankKey < b.rankKey ? -1 : a.rankKey > b.rankKey ? 1 : 0))
    .map((entry) => entry.entryId);
}

describe('duelSwapKeys', () => {
  test('vizinhas: só A muda, para logo abaixo de B', () => {
    const entries = ranking(['x', 'a', 'b', 'y']);
    const keys = duelSwapKeys(entries, 'a', 'b');
    assert.deepEqual([...keys.keys()], ['a']);
    assert.deepEqual(reorder(entries, keys), ['x', 'b', 'a', 'y']);
  });

  test('vizinhas no fim e no começo da lista', () => {
    const last = ranking(['x', 'a', 'b']);
    assert.deepEqual(reorder(last, duelSwapKeys(last, 'a', 'b')), ['x', 'b', 'a']);
    const first = ranking(['a', 'b', 'y']);
    assert.deepEqual(reorder(first, duelSwapKeys(first, 'a', 'b')), ['b', 'a', 'y']);
  });

  test('distantes (a lista mudou depois que o duelo abriu): cada uma vai para o lugar da outra', () => {
    const entries = ranking(['a', 'm', 'n', 'b', 'z']);
    assert.deepEqual(reorder(entries, duelSwapKeys(entries, 'a', 'b')), ['b', 'm', 'n', 'a', 'z']);
  });

  test('B já está na frente: nada muda', () => {
    assert.equal(duelSwapKeys(ranking(['b', 'a']), 'a', 'b').size, 0);
  });

  test('filme que saiu da lista ou chaves empatadas: conflito', () => {
    assert.throws(() => duelSwapKeys(ranking(['a', 'x']), 'a', 'b'), { code: 'conflict' });
    const tied = [
      { entryId: 'a', rankKey: 'a0' },
      { entryId: 'b', rankKey: 'a1' },
      { entryId: 'c', rankKey: 'a1' },
    ];
    assert.throws(() => duelSwapKeys(tied, 'a', 'b'), { code: 'conflict' });
  });
});

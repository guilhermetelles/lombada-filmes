import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { orderResults } from '../../lib/discover/order-results.js';

/** Filmes na ordem do TMDb (0 = o mais popular), com a compatibilidade e as palavras da frase. */
const items = [
  { id: 'a', tmdbIndex: 0, score: 40, matches: 0 },
  { id: 'b', tmdbIndex: 1, score: 42, matches: 0 },
  { id: 'c', tmdbIndex: 2, score: 70, matches: 0 },
  { id: 'd', tmdbIndex: 3, score: 30, matches: 1 },
];

describe('orderResults', () => {
  test('palavras da frase vêm antes em qualquer ordem', () => {
    assert.equal(orderResults(items, 'relevance', 4)[0]?.id, 'd');
    assert.equal(orderResults(items, 'compat', 4)[0]?.id, 'd');
  });

  test('compat: só a compatibilidade decide depois das palavras', () => {
    assert.deepEqual(
      orderResults(items, 'compat', 4).map((item) => item.id),
      ['d', 'c', 'b', 'a'],
    );
  });

  test('relevance: diferença pequena de compatibilidade não passa à frente da posição no TMDb', () => {
    // a: 0,5 × 1 + 0,5 × 0,25 = 0,625; b: 0,5 × 0,67 + 0,5 × 0,3 = 0,48; c: 0,5 × 0,33 + 0,5 × 1 = 0,67
    assert.deepEqual(
      orderResults(items, 'relevance', 4).map((item) => item.id),
      ['d', 'c', 'a', 'b'],
    );
  });

  test('relevance: compatibilidade igual em todos mantém a ordem do TMDb', () => {
    const flat = items.map((item) => ({ ...item, score: 50, matches: 0 }));
    assert.deepEqual(
      orderResults(flat, 'relevance', 4).map((item) => item.id),
      ['a', 'b', 'c', 'd'],
    );
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { nextUnwatchedPart } from '../../lib/recs/gather-candidates.js';
import type { TmdbCollectionPart } from '../../lib/types/sources.js';

/** Monta um filme de saga. */
const part = (tmdbId: number, release: string | null): TmdbCollectionPart => ({
  tmdbId,
  title: `Filme ${tmdbId}`,
  release,
});

const TODAY = '2026-10-18';

describe('nextUnwatchedPart', () => {
  test('o primeiro por data de estreia que não está na lista, fora da ordem do TMDb', () => {
    const parts = [part(3, '1990-06-01'), part(1, '1979-05-25'), part(2, '1986-07-18')];
    assert.equal(nextUnwatchedPart(parts, new Set([1]), TODAY), 2);
  });

  test('filme sem data ou que ainda não estreou fica de fora; o que estreia hoje entra', () => {
    const parts = [part(1, '1979-05-25'), part(2, null), part(3, '2027-01-01')];
    assert.equal(nextUnwatchedPart(parts, new Set([1]), TODAY), null);
    assert.equal(nextUnwatchedPart([part(1, '1979-05-25'), part(4, TODAY)], new Set([1]), TODAY), 4);
  });

  test('lista com um filme do meio: sugere o primeiro que falta', () => {
    const parts = [part(1, '1979-05-25'), part(2, '1986-07-18'), part(3, '1992-05-22')];
    assert.equal(nextUnwatchedPart(parts, new Set([2]), TODAY), 1);
  });
});

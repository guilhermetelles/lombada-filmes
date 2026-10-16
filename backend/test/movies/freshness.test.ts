import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FRESHNESS_MS, isStale } from '../../lib/movies/freshness.js';
import { mergeMovie } from '../../lib/movies/merge-movie.js';
import { omdbAbyss, tmdbAbyss } from '../support/movie-samples.js';

const fetchedAt = new Date('2026-10-01T12:00:00Z');
const after = (ms: number) => new Date(fetchedAt.getTime() + ms);

describe('isStale', () => {
  test('sem documento guardado: todas as fontes vencidas', () => {
    assert.equal(isStale(undefined, 'tmdb', fetchedAt), true);
  });

  test('fonte que nunca foi buscada: vencida', () => {
    const movie = mergeMovie(undefined, { tmdb: tmdbAbyss }, fetchedAt);
    assert.equal(isStale(movie, 'letterboxd', fetchedAt), true);
  });

  test('vence exatamente aos 7 dias', () => {
    const movie = mergeMovie(undefined, { tmdb: tmdbAbyss, omdb: omdbAbyss }, fetchedAt);
    assert.equal(isStale(movie, 'omdb', after(FRESHNESS_MS - 1)), false);
    assert.equal(isStale(movie, 'omdb', after(FRESHNESS_MS)), true);
  });
});

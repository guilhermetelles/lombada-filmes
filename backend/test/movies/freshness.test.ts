import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FRESHNESS_MS, isStale, needsRefresh, oldestRatingFetch } from '../../lib/movies/freshness.js';
import { mergeMovie } from '../../lib/movies/merge-movie.js';
import { letterboxdAbyss, omdbAbyss, tmdbAbyss } from '../support/movie-samples.js';

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

  test('TMDb também vence aos 7 dias', () => {
    const movie = mergeMovie(undefined, { tmdb: tmdbAbyss }, fetchedAt);
    assert.equal(isStale(movie, 'tmdb', after(FRESHNESS_MS - 1)), false);
    assert.equal(isStale(movie, 'tmdb', after(FRESHNESS_MS)), true);
  });

  test('TMDb vence na hora com diretor sem o campo da foto; foto null conta como completa', () => {
    const movie = mergeMovie(undefined, { tmdb: tmdbAbyss }, fetchedAt);
    const oldFormat = { ...movie, directors: [{ id: 2710, name: 'James Cameron' }] };
    const withoutPhoto = { ...movie, directors: [{ id: 2710, name: 'James Cameron', profilePath: null }] };

    assert.equal(isStale(oldFormat, 'tmdb', fetchedAt), true);
    assert.equal(isStale(withoutPhoto, 'tmdb', fetchedAt), false);
  });

  test('vence exatamente aos 7 dias', () => {
    const movie = mergeMovie(undefined, { tmdb: tmdbAbyss, omdb: omdbAbyss }, fetchedAt);
    assert.equal(isStale(movie, 'omdb', after(FRESHNESS_MS - 1)), false);
    assert.equal(isStale(movie, 'omdb', after(FRESHNESS_MS)), true);
  });
});

describe('needsRefresh e oldestRatingFetch', () => {
  test('só as notas contam; sem id do IMDb, a OMDb não conta', () => {
    const movie = mergeMovie(undefined, { tmdb: tmdbAbyss, letterboxd: letterboxdAbyss, omdb: omdbAbyss }, fetchedAt);
    const withoutImdb = {
      ...movie,
      ids: { ...movie.ids, imdb: null },
      ratings: { letterboxd: movie.ratings.letterboxd },
    };

    assert.equal(needsRefresh(movie, after(FRESHNESS_MS - 1)), false);
    assert.equal(needsRefresh(movie, after(FRESHNESS_MS)), true);
    assert.equal(needsRefresh(withoutImdb, after(FRESHNESS_MS - 1)), false);
  });

  test('a nota mais antiga define a ordem; filme sem nota vem antes de todos', () => {
    const tmdbOnly = mergeMovie(undefined, { tmdb: tmdbAbyss }, fetchedAt);
    const withLetterboxd = mergeMovie(tmdbOnly, { letterboxd: letterboxdAbyss }, after(1000));

    assert.equal(oldestRatingFetch(tmdbOnly).getTime(), 0);
    assert.equal(
      oldestRatingFetch(mergeMovie(withLetterboxd, { omdb: omdbAbyss }, after(2000))).getTime(),
      after(1000).getTime(),
    );
  });
});

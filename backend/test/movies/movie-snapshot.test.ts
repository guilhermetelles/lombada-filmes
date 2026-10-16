import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mergeMovie } from '../../lib/movies/merge-movie.js';
import { isSameSnapshot, toMovieSnapshot } from '../../lib/movies/movie-snapshot.js';
import { letterboxdAbyss, omdbAbyss, tmdbAbyss } from '../support/movie-samples.js';

const abyss = mergeMovie(undefined, { tmdb: tmdbAbyss, letterboxd: letterboxdAbyss, omdb: omdbAbyss }, new Date());

describe('cópia resumida do filme', () => {
  test('toMovieSnapshot pega título, ano, capa e as notas do IMDb e do Letterboxd', () => {
    assert.deepEqual(toMovieSnapshot(abyss), {
      title: 'The Abyss',
      year: 1989,
      posterPath: '/abyss.jpg',
      imdb: 7.5,
      letterboxd: 3.72,
    });
  });

  test('isSameSnapshot compara campo a campo e rejeita o que não é objeto', () => {
    const snapshot = toMovieSnapshot(abyss);
    assert.equal(isSameSnapshot(snapshot, { ...snapshot }), true);
    assert.equal(isSameSnapshot(snapshot, { ...snapshot, imdb: 7.4 }), false);
    assert.equal(isSameSnapshot(snapshot, undefined), false);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mergeMovie } from '../../lib/movies/merge-movie.js';
import { letterboxdAbyss, omdbAbyss, tmdbAbyss } from '../support/movie-samples.js';

const firstDay = new Date('2026-10-01T12:00:00Z');
const nextDay = new Date('2026-10-02T12:00:00Z');
const storedAbyss = () =>
  mergeMovie(undefined, { tmdb: tmdbAbyss, letterboxd: letterboxdAbyss, omdb: omdbAbyss }, firstDay);

describe('mergeMovie', () => {
  test('primeira vez: monta o documento com as três fontes', () => {
    const movie = storedAbyss();

    assert.equal(movie.title, 'The Abyss');
    assert.deepEqual(movie.ids, { imdb: 'tt0096754', letterboxd: 'https://letterboxd.com/film/the-abyss/' });
    assert.deepEqual(movie.ratings.letterboxd, { value: 3.72, count: 174_000, fetchedAt: firstDay });
    assert.deepEqual(movie.ratings.imdb, { value: 7.5, votes: 211_000, fetchedAt: firstDay });
    assert.deepEqual(movie.ratings.metacritic, { value: 62, fetchedAt: firstDay });
    assert.equal(movie.tmdbFetchedAt, firstDay);
  });

  test('só a fonte que veio é atualizada; as outras mantêm o valor e a data', () => {
    const movie = mergeMovie(storedAbyss(), { letterboxd: { ...letterboxdAbyss, value: 3.8 } }, nextDay);

    assert.deepEqual(movie.ratings.letterboxd, { value: 3.8, count: 174_000, fetchedAt: nextDay });
    assert.deepEqual(movie.ratings.imdb, { value: 7.5, votes: 211_000, fetchedAt: firstDay });
    assert.equal(movie.tmdbFetchedAt, firstDay);
  });

  test('TMDb novo troca o catálogo e mantém as notas e o endereço do Letterboxd', () => {
    const movie = mergeMovie(storedAbyss(), { tmdb: { ...tmdbAbyss, title: 'The Abyss (Special Edition)' } }, nextDay);

    assert.equal(movie.title, 'The Abyss (Special Edition)');
    assert.equal(movie.ids.letterboxd, letterboxdAbyss.url);
    assert.equal(movie.ratings.letterboxd?.value, 3.72);
    assert.equal(movie.tmdbFetchedAt, nextDay);
  });

  test('Letterboxd sem o filme mantém o endereço guardado e grava a nota vazia com a data', () => {
    const movie = mergeMovie(storedAbyss(), { letterboxd: { value: null, count: null, url: null } }, nextDay);

    assert.equal(movie.ids.letterboxd, letterboxdAbyss.url);
    assert.deepEqual(movie.ratings.letterboxd, { value: null, count: null, fetchedAt: nextDay });
  });

  test('sem documento guardado, o TMDb é obrigatório', () => {
    assert.throws(() => mergeMovie(undefined, { letterboxd: letterboxdAbyss }, firstDay), /TMDb é obrigatório/);
  });
});

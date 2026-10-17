import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mergeMovie } from '../../lib/movies/merge-movie.js';
import { isSameSnapshot, toMovieSnapshot } from '../../lib/movies/movie-snapshot.js';
import { letterboxdAbyss, omdbAbyss, tmdbAbyss } from '../support/movie-samples.js';

const abyss = mergeMovie(undefined, { tmdb: tmdbAbyss, letterboxd: letterboxdAbyss, omdb: omdbAbyss }, new Date());

describe('cópia resumida do filme', () => {
  test('toMovieSnapshot pega título, ano, capa, as notas do IMDb e do Letterboxd e quem dirigiu', () => {
    assert.deepEqual(toMovieSnapshot(abyss), {
      title: 'The Abyss',
      year: 1989,
      posterPath: '/abyss.jpg',
      imdb: 7.5,
      letterboxd: 3.72,
      directors: [{ id: 2710, name: 'James Cameron' }],
    });
  });

  test('isSameSnapshot compara campo a campo e rejeita o que não é objeto', () => {
    const snapshot = toMovieSnapshot(abyss);
    assert.equal(isSameSnapshot(snapshot, { ...snapshot }), true);
    assert.equal(isSameSnapshot(snapshot, { ...snapshot, imdb: 7.4 }), false);
    assert.equal(isSameSnapshot(snapshot, undefined), false);
  });

  test('o elenco não entra na cópia resumida', () => {
    assert.equal('cast' in toMovieSnapshot(abyss), false);
  });

  test('a cópia leva só os 8 primeiros diretores (limite das regras do Firestore)', () => {
    const anthology = { ...abyss, directors: Array.from({ length: 11 }, (_, i) => ({ id: i + 1, name: `D${i}` })) };
    assert.deepEqual(
      toMovieSnapshot(anthology).directors.map((director) => director.id),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
  });

  test('a cópia fica dentro dos limites das regras do Firestore', () => {
    const outOfLimits = {
      ...abyss,
      title: 'T'.repeat(400),
      year: 3000,
      posterPath: `/${'p'.repeat(250)}.jpg`,
      directors: [
        { id: 0, name: 'Sem id' },
        { id: 5, name: '   ' },
        { id: 7, name: 'N'.repeat(250) },
      ],
    };

    const snapshot = toMovieSnapshot(outOfLimits);

    assert.equal(snapshot.title.length, 300);
    assert.equal(snapshot.year, null);
    assert.equal(snapshot.posterPath, null);
    assert.deepEqual(snapshot.directors, [{ id: 7, name: 'N'.repeat(200) }]);
  });

  test('isSameSnapshot compara os diretores pela ordem, por id e nome', () => {
    const snapshot = toMovieSnapshot(abyss);
    const coDirected = [...snapshot.directors, { id: 1, name: 'Outra Pessoa' }];
    assert.equal(isSameSnapshot(snapshot, { ...snapshot, directors: coDirected }), false);
    assert.equal(isSameSnapshot(snapshot, { ...snapshot, directors: [{ id: 2710, name: 'J. Cameron' }] }), false);
    assert.equal(isSameSnapshot(snapshot, { ...snapshot, directors: undefined }), false);
  });
});

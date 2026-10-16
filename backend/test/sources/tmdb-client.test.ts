import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NotFoundError, SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { createTmdbClient } from '../../lib/sources/tmdb/tmdb-client.js';
import type { Fetch } from '../../lib/types/sources.js';
import { fakeSources, respondWith } from '../support/fake-sources.js';

const tmdbClient = (fetch: Fetch = fakeSources().fetch) => createTmdbClient({ token: 'token', fetch });

describe('TMDb: getMovie', () => {
  test('título em inglês, gêneros e sinopse em português, diretor e id do IMDb', async () => {
    const movie = await tmdbClient().getMovie(2756);

    assert.equal(movie.title, 'The Abyss');
    assert.equal(movie.year, 1989);
    assert.equal(movie.runtime, 138);
    assert.deepEqual(movie.directors, ['James Cameron']);
    assert.deepEqual(movie.genres, ['Aventura', 'Thriller', 'Ficção científica']);
    assert.equal(movie.imdbId, 'tt0096754');
    assert.match(movie.posterPath ?? '', /^\/.+\.jpg$/);
    assert.ok(movie.synopsis.pt && movie.synopsis.en);
    assert.notEqual(movie.synopsis.pt, movie.synopsis.en);
  });

  test('sem tradução em inglês, usa o título original', async () => {
    const response = { id: 1, original_title: 'Katakuri-ke no kōfuku', title: 'A Felicidade dos Katakuris' };
    const movie = await tmdbClient(respondWith(response)).getMovie(1);

    assert.equal(movie.title, 'Katakuri-ke no kōfuku');
    assert.equal(movie.year, null);
    assert.equal(movie.imdbId, null);
  });

  test('filme inexistente: NotFoundError', async () => {
    await assert.rejects(tmdbClient().getMovie(99999999), NotFoundError);
  });

  test('fonte fora do ar, resposta que não é JSON ou fora do formato: SourceUnavailableError', async () => {
    await assert.rejects(tmdbClient(respondWith('fora do ar', { status: 503 })).getMovie(2756), SourceUnavailableError);
    await assert.rejects(tmdbClient(respondWith('<html>')).getMovie(2756), SourceUnavailableError);
    await assert.rejects(tmdbClient(respondWith({ id: 'texto' })).getMovie(2756), SourceUnavailableError);
  });

  test('falha de rede: SourceUnavailableError', async () => {
    const offline: Fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await assert.rejects(tmdbClient(offline).getMovie(2756), SourceUnavailableError);
  });
});

describe('TMDb: search', () => {
  test('devolve o resumo de cada resultado, com o título em português', async () => {
    const results = await tmdbClient().search('abismo');
    const abyss = results.find((result) => result.tmdbId === 2756);

    assert.deepEqual(
      { title: abyss?.title, originalTitle: abyss?.originalTitle, year: abyss?.year },
      { title: 'O Segredo do Abismo', originalTitle: 'The Abyss', year: 1989 },
    );
  });

  test('a sinopse vira um trecho de até 200 caracteres', async () => {
    const response = { results: [{ id: 1, title: 'Longo', overview: 'palavra '.repeat(100) }] };
    const [result] = await tmdbClient(respondWith(response)).search('longo');

    assert.equal(result?.overview?.length, 200);
    assert.ok(result?.overview?.endsWith('…'));
  });
});

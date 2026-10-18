import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { createOmdbClient } from '../../lib/sources/omdb/omdb-client.js';
import type { Fetch } from '../../lib/types/sources.js';
import { fakeSources, respondWith } from '../support/fake-sources.js';

const API_KEY = 'chave-secreta';
const omdbClient = (fetch: Fetch = fakeSources().fetch) => createOmdbClient({ apiKey: API_KEY, fetch });

describe('OMDb: getRatings', () => {
  test('IMDb, Rotten Tomatoes com o link e Metacritic', async () => {
    const ratings = await omdbClient().getRatings('tt0096754');

    assert.equal(ratings.imdb.value, 7.5);
    assert.ok((ratings.imdb.votes ?? 0) > 200_000);
    assert.deepEqual(ratings.rottenTomatoes, { value: 75, url: 'https://www.rottentomatoes.com/m/abyss/' });
    assert.deepEqual(ratings.metacritic, { value: 62 });
  });

  test('resumo de prêmios em português e bilheteria nos EUA em número', async () => {
    const ratings = await omdbClient().getRatings('tt0096754');

    assert.equal(ratings.awardsSummary, 'Ganhou 1 Oscar. 9 prêmios e 16 indicações no total');
    assert.equal(ratings.boxOfficeUS, 54_981_151);
  });

  test('"N/A" vira null', async () => {
    const response = { Response: 'True', imdbRating: 'N/A', imdbVotes: 'N/A', Metascore: 'N/A', tomatoURL: 'N/A' };
    const ratings = await omdbClient(respondWith(response)).getRatings('tt1');

    assert.deepEqual(ratings, {
      imdb: { value: null, votes: null },
      rottenTomatoes: { value: null, url: null },
      metacritic: { value: null },
      awardsSummary: null,
      boxOfficeUS: null,
    });
  });

  test('filme que a OMDb não tem: notas null, sem erro', async () => {
    const notFound = respondWith({ Response: 'False', Error: 'Movie not found!' });
    const ratings = await omdbClient(notFound).getRatings('tt1');

    assert.deepEqual(ratings.imdb, { value: null, votes: null });
  });

  test('outros erros da OMDb (como cota estourada): SourceUnavailableError', async () => {
    const limitReached = respondWith({ Response: 'False', Error: 'Request limit reached!' });
    await assert.rejects(omdbClient(limitReached).getRatings('tt1'), SourceUnavailableError);
  });

  test('a chave da API não aparece na mensagem de erro', async () => {
    const error = await omdbClient(respondWith('erro', { status: 500 }))
      .getRatings('tt1')
      .catch((caught: unknown) => caught);

    assert.ok(error instanceof SourceUnavailableError);
    assert.ok(!error.message.includes(API_KEY));
  });
});

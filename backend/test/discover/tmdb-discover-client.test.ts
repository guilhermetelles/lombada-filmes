import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createTmdbDiscoverClient } from '../../lib/discover/tmdb-discover-client.js';
import { NotFoundError, SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { discoverFetch } from './discover-fixtures.js';

describe('createTmdbDiscoverClient (gravações reais)', () => {
  test('discover: página com os filmes no formato da busca e o token no cabeçalho', async () => {
    const tmdb = discoverFetch();
    let authorization: string | null = null;
    const client = createTmdbDiscoverClient({
      token: 'token-de-teste',
      fetch: async (input, init) => {
        authorization = new Headers(init?.headers).get('authorization');
        return tmdb.fetch(input, init);
      },
    });

    const page = await client.discover(new URLSearchParams({ with_genres: '35', page: '1' }));

    assert.equal(authorization, 'Bearer token-de-teste');
    assert.equal(tmdb.urls[0]?.search, '?with_genres=35&page=1');
    assert.equal(page.page, 1);
    assert.equal(page.totalPages, 14);
    assert.equal(page.results.length, 20);
    assert.deepEqual(page.results[0], {
      tmdbId: 490132,
      title: 'Green Book: O Guia',
      // Original em inglês: vira o título em inglês das sugestões "Em alta" sem documento em movies/.
      titleEn: 'Green Book',
      year: 2018,
      posterPath: '/u9dldwRwQjTZGlIxKaAtAPLAjOv.jpg',
      genreIds: [18, 35, 36],
      vote: 8.224,
      votes: 13382,
      popularity: 41.4745,
    });
  });

  test('trendingWeek: os 20 filmes em alta, em pt-BR', async () => {
    const tmdb = discoverFetch();
    const trending = await createTmdbDiscoverClient({ token: 't', fetch: tmdb.fetch }).trendingWeek();
    assert.equal(trending.length, 20);
    assert.equal(tmdb.urls[0]?.searchParams.get('language'), 'pt-BR');
  });

  test('movieExtras: duração, só serviços conhecidos (sem "with Ads" nem canais) e palavras-chave', async () => {
    const tmdb = discoverFetch();
    const client = createTmdbDiscoverClient({ token: 't', fetch: tmdb.fetch });

    const greenBook = await client.movieExtras(490132);
    assert.equal(greenBook.runtime, 131);
    assert.deepEqual(greenBook.providers, ['Amazon Prime Video']);
    assert.equal(greenBook.keywords.length, 14);
    assert.equal(tmdb.urls[0]?.searchParams.get('append_to_response'), 'watch/providers,keywords');

    // Clube da Luta para Meninas só está em canais (MGM+), que ficam de fora.
    assert.deepEqual((await client.movieExtras(814776)).providers, []);
  });

  test('filme que o TMDb não tem: NotFoundError; TMDb fora do ar: SourceUnavailableError', async () => {
    const tmdb = discoverFetch();
    const client = createTmdbDiscoverClient({ token: 't', fetch: tmdb.fetch });
    await assert.rejects(client.movieExtras(1), NotFoundError);
    tmdb.failing.add('discover');
    await assert.rejects(client.discover(new URLSearchParams()), SourceUnavailableError);
  });
});

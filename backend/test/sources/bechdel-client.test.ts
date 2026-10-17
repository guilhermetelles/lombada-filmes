import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NotFoundError, SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { createBechdelClient } from '../../lib/sources/bechdel/bechdel-client.js';
import type { Fetch } from '../../lib/types/sources.js';
import { fakeSources, respondWith } from '../support/fake-sources.js';

const bechdelClient = (fetch: Fetch = fakeSources().fetch) => createBechdelClient({ fetch });

/**
 * Cria um fetch que responde por caminho, para montar o redirecionamento e a página final.
 *
 * @param pages - HTML de cada caminho; os outros respondem 404.
 * @returns O fetch e os caminhos pedidos, em ordem.
 */
function sitePages(pages: Record<string, string>): { fetch: Fetch; requested: string[] } {
  const requested: string[] = [];
  const fetch: Fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    requested.push(url.pathname);
    const html = pages[url.pathname];
    return html === undefined ? new Response('não encontrado', { status: 404 }) : new Response(html);
  };
  return { fetch, requested };
}

/** Redirecionamento como o site serve em /view/{id}/. */
const redirectTo = (href: string) => `<head><link rel="canonical" href="${href}"></head>`;

/** Página final mínima de um filme. */
const moviePage = (body: string) =>
  `<head><link rel="canonical" href="https://bechdeltest.com/view/1/x/"></head><body>${body}</body>`;

describe('bechdeltest.com: getIndex', () => {
  test('lê as tuplas do índice', async () => {
    const index = await bechdelClient().getIndex();

    assert.deepEqual(
      index.find((entry) => entry.siteId === 1478),
      { siteId: 1478, title: 'Abyss, The', year: 1989, rating: 3, dubious: false },
    );
    assert.equal(index.find((entry) => entry.siteId === 847)?.dubious, true);
  });

  test('índice fora do formato: SourceUnavailableError', async () => {
    for (const body of [{ filmes: [] }, [[1478, 'Abyss, The', 1989, 4, 0]], [[1478, 'Abyss, The', 1989, 3]]]) {
      await assert.rejects(bechdelClient(respondWith(body)).getIndex(), SourceUnavailableError);
    }
  });

  test('site fora do ar: SourceUnavailableError', async () => {
    await assert.rejects(bechdelClient(respondWith('erro', { status: 503 })).getIndex(), SourceUnavailableError);
  });
});

describe('bechdeltest.com: getMoviePage', () => {
  test('segue o canônico e lê IMDb, critérios, duvidosa e contestações de The Abyss', async () => {
    const sources = fakeSources();

    const page = await bechdelClient(sources.fetch).getMoviePage(1478);

    assert.deepEqual(page, {
      siteId: 1478,
      url: 'https://bechdeltest.com/view/1478/the_abyss/',
      imdbId: 'tt0096754',
      rating: 3,
      dubious: false,
      disputes: 1,
    });
    assert.equal(sources.calls.bechdel, 2);
  });

  test('canônico com entidades HTML: desfeitas no pedido e codificadas no endereço guardado', async () => {
    const { fetch, requested } = sitePages({
      '/view/2198/': redirectTo('/view/2198/a_bug&#x27;s_life/'),
      "/view/2198/a_bug's_life/": moviePage('This movie passed 3 of 3 tests.'),
      '/view/2309/': redirectTo('/view/2309/south_park:_bigger_longer_&amp;_uncut/'),
      '/view/2309/south_park:_bigger_longer_&_uncut/': moviePage('This movie passed 1 of 3 tests.'),
    });
    const client = bechdelClient(fetch);

    assert.equal((await client.getMoviePage(2198)).url, 'https://bechdeltest.com/view/2198/a_bug%27s_life/');
    assert.equal(
      (await client.getMoviePage(2309)).url,
      'https://bechdeltest.com/view/2309/south_park:_bigger_longer_%26_uncut/',
    );
    assert.deepEqual(requested, [
      '/view/2198/',
      "/view/2198/a_bug's_life/",
      '/view/2309/',
      '/view/2309/south_park:_bigger_longer_&_uncut/',
    ]);
  });

  test('avaliação duvidosa e várias contestações', async () => {
    const { fetch } = sitePages({
      '/view/7/': redirectTo('/view/7/filme/'),
      '/view/7/filme/': moviePage(
        [
          '<a href="https://www.imdb.com/title/tt0000007/">',
          '<p>This movie passed 2 of 3 tests (although dubious).</p>',
          '<div class="name"><b>ana</b> disagreed with the rating and said:</div>',
          '<div class="name"><b>bia</b> said:</div><div class="text">I disagreed with the rating too</div>',
          '<div class="name"><b>caio</b> disagreed with the rating and said:</div>',
        ].join('\n'),
      ),
    });

    const page = await bechdelClient(fetch).getMoviePage(7);

    assert.deepEqual(
      { imdbId: page.imdbId, rating: page.rating, dubious: page.dubious, disputes: page.disputes },
      { imdbId: 'tt0000007', rating: 2, dubious: true, disputes: 2 },
    );
  });

  test('página sem link do IMDb: imdbId null', async () => {
    const { fetch } = sitePages({
      '/view/8/': redirectTo('/view/8/filme/'),
      '/view/8/filme/': moviePage('This movie passed 0 of 3 tests.'),
    });
    assert.equal((await bechdelClient(fetch).getMoviePage(8)).imdbId, null);
  });

  test('formato mudado (sem canônico, sem avaliação ou canônico de outro filme): SourceUnavailableError', async () => {
    const broken = [
      { '/view/9/': '<html>sem canônico</html>' },
      { '/view/9/': redirectTo('/view/9/filme/'), '/view/9/filme/': moviePage('Passed 3 of 3') },
      { '/view/9/': redirectTo('/view/90/outro/') },
      { '/view/9/': redirectTo('https://outro-site.com/view/9/filme/') },
    ];
    for (const pages of broken) {
      await assert.rejects(bechdelClient(sitePages(pages).fetch).getMoviePage(9), SourceUnavailableError);
    }
  });

  test('id que o site não tem: NotFoundError', async () => {
    await assert.rejects(bechdelClient(sitePages({}).fetch).getMoviePage(10), NotFoundError);
  });
});

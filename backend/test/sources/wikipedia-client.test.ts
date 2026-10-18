import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { categoryToAward } from '../../lib/sources/wikipedia/category-awards.js';
import { createWikipediaClient } from '../../lib/sources/wikipedia/wikipedia-client.js';
import type { Fetch } from '../../lib/types/sources.js';
import { fakeWikimedia } from '../enrich/fake-wikimedia.js';
import { respondWith } from '../support/fake-sources.js';

const client = (fetch: Fetch) =>
  createWikipediaClient({ fetch, retry: { retries: 2, maxDelayMs: 0, wait: async () => {} } });

const ARTICLES = [
  { tmdbId: 2756, title: 'The Abyss' },
  { tmdbId: 50620, title: 'The Twilight Saga: Breaking Dawn – Part 2' },
  { tmdbId: 1054867, title: 'One Battle After Another' },
];

describe('Wikipedia: awardsByArticles', () => {
  test('um pedido para os artigos do lote, com as categorias visíveis', async () => {
    const wikimedia = fakeWikimedia();
    await client(wikimedia.fetch).awardsByArticles(ARTICLES);

    assert.equal(wikimedia.requests.length, 1);
    const params = wikimedia.requests[0]?.searchParams;
    assert.equal(params?.get('titles'), ARTICLES.map((article) => article.title).join('|'));
    assert.equal(params?.get('prop'), 'categories');
    assert.equal(params?.get('clshow'), '!hidden');
  });

  test('Breaking Dawn – Part 2: vitória na Framboesa de Ouro, sem categoria nem ano', async () => {
    const awards = await client(fakeWikimedia().fetch).awardsByArticles(ARTICLES);

    assert.deepEqual(awards.get(50620), [{ org: 'Framboesa de Ouro', cat: null, kind: 'win', year: null }]);
  });

  test('The Abyss: Oscar de efeitos visuais e Saturn; premiações fora da lista ficam de fora', async () => {
    const awards = await client(fakeWikimedia().fetch).awardsByArticles(ARTICLES);

    assert.deepEqual(awards.get(2756), [
      { org: 'Oscar', cat: 'melhores efeitos visuais', kind: 'win', year: null },
      { org: 'Saturn', cat: null, kind: 'win', year: null },
    ]);
    assert.ok((awards.get(1054867) ?? []).every((item) => item.org !== 'Satellite'));
  });

  test('título normalizado ou redirecionado volta para o filme pedido; segue a continuação', async () => {
    const pages: unknown[] = [
      {
        continue: { clcontinue: '1|x', continue: '||' },
        query: {
          redirects: [{ from: 'Abyss (film)', to: 'The Abyss' }],
          pages: [{ title: 'The Abyss', categories: [{ title: 'Category:Saturn Award–winning films' }] }],
        },
      },
      {
        query: {
          redirects: [{ from: 'Abyss (film)', to: 'The Abyss' }],
          pages: [{ title: 'The Abyss', categories: [{ title: 'Category:Golden Raspberry Award–winning films' }] }],
        },
      },
    ];
    const seen: URL[] = [];
    const paged: Fetch = async (input) => {
      seen.push(new URL(String(input)));
      return Response.json(pages[seen.length - 1]);
    };
    const awards = await client(paged).awardsByArticles([{ tmdbId: 2756, title: 'Abyss (film)' }]);

    assert.equal(seen[1]?.searchParams.get('clcontinue'), '1|x');
    assert.deepEqual(
      awards.get(2756)?.map((item) => item.org),
      ['Saturn', 'Framboesa de Ouro'],
    );
  });

  test('fora do ar ou fora do formato: SourceUnavailableError', async () => {
    await assert.rejects(client(respondWith('x', { status: 500 })).awardsByArticles(ARTICLES), SourceUnavailableError);
    await assert.rejects(
      client(respondWith({ query: { pages: 'x' } })).awardsByArticles(ARTICLES),
      SourceUnavailableError,
    );
  });
});

describe('categoryToAward', () => {
  test('categorias de vitória nas premiações conhecidas, em português', () => {
    assert.deepEqual(categoryToAward('Category:Best Picture Academy Award winners'), {
      org: 'Oscar',
      cat: 'melhor filme',
      kind: 'win',
      year: null,
    });
    assert.equal(categoryToAward('Films whose director won the Best Directing Academy Award')?.cat, 'melhor direção');
    assert.equal(
      categoryToAward('Films featuring a Best Supporting Actor Academy Award–winning performance')?.cat,
      'melhor ator coadjuvante',
    );
    assert.equal(
      categoryToAward('Films whose casting directors won the Achievement in Casting Academy Award')?.cat,
      'melhor seleção de elenco',
    );
    assert.equal(categoryToAward('Best Musical or Comedy Picture Golden Globe winners')?.org, 'Globo de Ouro');
    assert.equal(categoryToAward("Palme d'Or winners")?.cat, 'Palma de Ouro');
    assert.equal(categoryToAward('BAFTA winners (films)')?.cat, null);
  });

  test('o que não é prêmio conhecido nem vitória ou indicação vira null', () => {
    assert.equal(categoryToAward('Teen Choice Award–winning films'), null);
    assert.equal(categoryToAward('Films about the Academy Awards'), null);
    assert.equal(categoryToAward('1989 films'), null);
  });
});

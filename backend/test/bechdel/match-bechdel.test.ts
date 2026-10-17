import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { matchBechdel } from '../../lib/bechdel/match-bechdel.js';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import type { BechdelClient, BechdelIndexEntry, BechdelPage } from '../../lib/types/sources.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';

/** Índice com um homônimo de ano vizinho, para o casamento precisar do IMDb. */
const index: BechdelIndexEntry[] = [
  { siteId: 1478, title: 'Abyss, The', year: 1989, rating: 3, dubious: false },
  { siteId: 9999, title: 'Abyss, The', year: 1990, rating: 0, dubious: false },
];

/** Página de cada id, com o IMDb de cada um. */
const pages: Record<number, BechdelPage> = {
  1478: {
    siteId: 1478,
    url: 'https://bechdeltest.com/view/1478/the_abyss/',
    imdbId: 'tt0096754',
    rating: 3,
    dubious: false,
    disputes: 1,
  },
  9999: {
    siteId: 9999,
    url: 'https://bechdeltest.com/view/9999/the_abyss/',
    imdbId: 'tt9999999',
    rating: 0,
    dubious: false,
    disputes: 0,
  },
};

/**
 * Cliente falso que serve as páginas acima e registra os ids pedidos.
 *
 * @param failing - Responde com falha a qualquer página.
 * @returns O cliente e os ids pedidos.
 */
function fakeClient(failing = false): { client: BechdelClient; requested: number[] } {
  const requested: number[] = [];
  const client: BechdelClient = {
    getIndex: async () => index,
    getMoviePage: async (siteId) => {
      requested.push(siteId);
      const page = pages[siteId];
      if (failing || !page) throw new SourceUnavailableError('bechdel', 'fora do ar');
      return page;
    },
  };
  return { client, requested };
}

const abyss = (imdb: string | null, year = 1989) => ({ title: 'The Abyss', year, ids: { imdb, letterboxd: null } });

describe('matchBechdel', () => {
  test('confirma pelo id do IMDb da página', async () => {
    const { client, requested } = fakeClient();
    const page = await matchBechdel(abyss('tt0096754'), index, client, new UsageMeter());

    assert.equal(page?.siteId, 1478);
    assert.deepEqual(requested, [1478]);
  });

  test('candidato com IMDb divergente é recusado e o próximo é conferido', async () => {
    const { client, requested } = fakeClient();
    // Ano 1990: o homônimo de 1990 vem primeiro, mas o IMDb é o do 1478.
    const page = await matchBechdel(abyss('tt0096754', 1990), index, client, new UsageMeter());

    assert.equal(page?.siteId, 1478);
    assert.deepEqual(requested, [9999, 1478]);
  });

  test('nenhum candidato confirmado: null', async () => {
    const { client } = fakeClient();
    assert.equal(await matchBechdel(abyss('tt0000001'), index, client, new UsageMeter()), null);
  });

  test('filme sem id do IMDb: null, sem pedir páginas', async () => {
    const { client, requested } = fakeClient();
    assert.equal(await matchBechdel(abyss(null), index, client, new UsageMeter()), null);
    assert.deepEqual(requested, []);
  });

  test('página de candidato com falha: o erro sobe, para não gravar "fora do site"', async () => {
    const { client } = fakeClient(true);
    await assert.rejects(matchBechdel(abyss('tt0096754'), index, client, new UsageMeter()), SourceUnavailableError);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mergeAwards } from '../../lib/enrich/merge-awards.js';
import { createWikidataClient } from '../../lib/sources/wikidata/wikidata-client.js';
import { createWikipediaClient } from '../../lib/sources/wikipedia/wikipedia-client.js';
import type { AwardItem } from '../../lib/types/awards.js';
import { fakeWikimedia } from './fake-wikimedia.js';

/** Monta um prêmio. */
const award = (org: string, cat: string | null, kind: 'win' | 'nom', year: number | null): AwardItem => ({
  org,
  cat,
  kind,
  year,
});

describe('mergeAwards', () => {
  test('mesma categoria escrita de jeitos diferentes, com e sem ano, vira um item; vitória vale mais', () => {
    const merged = mergeAwards(
      [
        award('Oscar', 'melhores efeitos visuais', 'nom', 1990),
        award('Oscar', 'melhores efeitos visuais', 'win', 1990),
      ],
      [award('Oscar', 'melhor efeitos visuais', 'win', null), award('Oscar', 'melhor diretor', 'nom', 1990)],
      [award('Oscar', 'melhor direção', 'nom', null)],
    );

    assert.deepEqual(merged, [
      award('Oscar', 'melhores efeitos visuais', 'win', 1990),
      award('Oscar', 'melhor diretor', 'nom', 1990),
    ]);
  });

  test('anos diferentes são prêmios diferentes', () => {
    const merged = mergeAwards([
      award('Saturn', 'melhor direção', 'win', 1987),
      award('Saturn', 'melhor direção', 'win', 1992),
    ]);
    assert.equal(merged.length, 2);
  });

  test('item sem categoria some quando há um específico tão forte, e fica ao lado de indicações', () => {
    assert.deepEqual(
      mergeAwards([award('Saturn', null, 'win', null), award('Saturn', 'melhor direção', 'win', 1990)]),
      [award('Saturn', 'melhor direção', 'win', 1990)],
    );
    assert.deepEqual(
      mergeAwards([
        award('Framboesa de Ouro', null, 'win', null),
        award('Framboesa de Ouro', 'pior ator', 'nom', 2013),
      ]),
      [award('Framboesa de Ouro', null, 'win', null), award('Framboesa de Ouro', 'pior ator', 'nom', 2013)],
    );
  });

  test('ordem: Oscar primeiro e Framboesa por último; vitórias antes de indicações; depois por ano', () => {
    const merged = mergeAwards([
      award('Framboesa de Ouro', 'pior filme', 'win', 2013),
      award('Saturn', 'melhor direção', 'win', 1990),
      award('Oscar', 'melhor fotografia', 'nom', 1990),
      award('Globo de Ouro', 'melhor direção', 'win', 1998),
      award('Oscar', 'melhor filme', 'win', 1998),
      award('Oscar', 'melhor edição', 'win', 1990),
    ]);

    assert.deepEqual(
      merged.map((item) => `${item.org}/${item.kind}/${item.year}`),
      [
        'Oscar/win/1990',
        'Oscar/win/1998',
        'Oscar/nom/1990',
        'Globo de Ouro/win/1998',
        'Saturn/win/1990',
        'Framboesa de Ouro/win/2013',
      ],
    );
  });
});

describe('prêmios das gravações reais (Wikidata e Wikipedia)', () => {
  /**
   * Junta os prêmios dos três filmes conferidos no passo 13 com as gravações das fontes.
   *
   * @returns Prêmios juntos por id do TMDb.
   */
  async function recordedAwards(): Promise<Map<number, AwardItem[]>> {
    const fetch = fakeWikimedia().fetch;
    const retry = { retries: 0, maxDelayMs: 0, wait: async () => {} };
    const wikidata = await createWikidataClient({ fetch, retry }).awardsByTmdbIds([2756, 50620, 1054867]);
    const articles = [...wikidata.enwikiTitles].map(([tmdbId, title]) => ({ tmdbId, title }));
    const wikipedia = await createWikipediaClient({ fetch, retry }).awardsByArticles(articles);
    return new Map(
      [2756, 50620, 1054867].map((id) => [id, mergeAwards(wikidata.awards.get(id) ?? [], wikipedia.get(id) ?? [])]),
    );
  }

  /**
   * Conta vitórias e indicações por premiação.
   *
   * @param items - Prêmios juntos.
   * @returns "Premiação: vitórias/indicações" em ordem.
   */
  const tally = (items: AwardItem[]) => {
    const orgs = [...new Set(items.map((item) => item.org))];
    return orgs.map((org) => {
      const ofOrg = items.filter((item) => item.org === org);
      return `${org}: ${ofOrg.filter((item) => item.kind === 'win').length}/${ofOrg.filter((item) => item.kind === 'nom').length}`;
    });
  };

  test('Breaking Dawn – Part 2: só a vitória na Framboesa de Ouro, pela Wikipedia', async () => {
    assert.deepEqual((await recordedAwards()).get(50620), [award('Framboesa de Ouro', null, 'win', null)]);
  });

  test('The Abyss: 1 Oscar e 3 indicações, sem repetir; Saturn pela Wikipedia', async () => {
    const abyss = (await recordedAwards()).get(2756) ?? [];
    assert.deepEqual(tally(abyss), ['Oscar: 1/3', 'Saturn: 1/0']);
    assert.deepEqual(abyss[0], award('Oscar', 'melhores efeitos visuais', 'win', 1990));
  });

  test('One Battle After Another: Oscar, Globo de Ouro, BAFTA e César sem repetidos', async () => {
    const battle = (await recordedAwards()).get(1054867) ?? [];
    assert.deepEqual(tally(battle), ['Oscar: 6/6', 'Globo de Ouro: 4/4', 'BAFTA: 3/0', 'César: 1/0']);
    const keys = battle.map((item) => `${item.org}|${item.cat}|${item.kind}`);
    assert.equal(new Set(keys).size, keys.length);
  });
});

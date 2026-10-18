import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import type { RetryOptions } from '../../lib/sources/shared/fetch-json-with-retry.js';
import { createWikidataClient, WIKIMEDIA_USER_AGENT } from '../../lib/sources/wikidata/wikidata-client.js';
import type { Fetch } from '../../lib/types/sources.js';
import { fakeWikimedia } from '../enrich/fake-wikimedia.js';
import { respondWith } from '../support/fake-sources.js';

/** Novas tentativas sem espera de verdade; guarda as esperas pedidas. */
const noWait = (waits: number[] = []): RetryOptions => ({
  retries: 2,
  maxDelayMs: 10_000,
  wait: async (ms) => {
    waits.push(ms);
  },
});

const client = (fetch: Fetch, waits?: number[]) => createWikidataClient({ fetch, retry: noWait(waits) });

describe('Wikidata: awardsByTmdbIds', () => {
  test('uma consulta SPARQL por lote, com os ids no VALUES, P4947, P166, P1411, inverso e User-Agent', async () => {
    const wikimedia = fakeWikimedia();
    await client(wikimedia.fetch).awardsByTmdbIds([2756, 50620, 1054867]);

    assert.equal(wikimedia.requests.length, 1);
    const query = wikimedia.requests[0]?.searchParams.get('query') ?? '';
    assert.match(query, /VALUES \?tmdb \{ "2756" "50620" "1054867" \}/);
    for (const property of ['P4947', 'P166', 'P1411', 'P1346', 'P2453', 'P585', 'P642', 'P1686']) {
      assert.ok(query.includes(property), property);
    }
    assert.match(query, /"pt-br,pt,en"/);
    assert.equal(wikimedia.headers[0]?.get('user-agent'), WIKIMEDIA_USER_AGENT);
    assert.match(WIKIMEDIA_USER_AGENT, /@/);
  });

  test('The Abyss: Oscar em português, com ano; One Battle After Another: Oscar e Globo de Ouro', async () => {
    const { awards } = await client(fakeWikimedia().fetch).awardsByTmdbIds([2756, 50620, 1054867]);

    const abyss = awards.get(2756) ?? [];
    assert.ok(
      abyss.some((item) => item.org === 'Oscar' && item.cat === 'melhores efeitos visuais' && item.kind === 'win'),
    );
    assert.ok(abyss.some((item) => item.org === 'Oscar' && item.cat === 'melhor fotografia' && item.kind === 'nom'));
    assert.ok(abyss.every((item) => item.year === 1990));

    const battle = awards.get(1054867) ?? [];
    assert.ok(battle.some((item) => item.org === 'Oscar' && item.cat === 'melhor filme' && item.kind === 'win'));
    assert.ok(battle.some((item) => item.org === 'Globo de Ouro' && item.cat === 'melhor comédia ou musical'));
    // Premiações fora da lista de cinema conhecida (Amanda Award) ficam de fora.
    assert.ok(battle.every((item) => item.org !== 'Amanda Award'));
  });

  test('título do artigo na Wikipedia em inglês; filme sem prêmios fica fora do mapa de prêmios', async () => {
    const { awards, enwikiTitles } = await client(fakeWikimedia().fetch).awardsByTmdbIds([2756, 50620, 1054867]);

    assert.equal(enwikiTitles.get(50620), 'The Twilight Saga: Breaking Dawn – Part 2');
    assert.equal(enwikiTitles.get(2756), 'The Abyss');
    assert.equal(awards.has(50620), false);
  });

  test('lote vazio: nenhum pedido', async () => {
    const wikimedia = fakeWikimedia();
    const result = await client(wikimedia.fetch).awardsByTmdbIds([]);

    assert.equal(wikimedia.requests.length, 0);
    assert.equal(result.awards.size, 0);
  });

  test('429: espera o Retry-After e tenta de novo', async () => {
    const wikimedia = fakeWikimedia();
    let calls = 0;
    const throttled: Fetch = async (input, init) => {
      calls++;
      if (calls === 1) return new Response('devagar', { status: 429, headers: { 'retry-after': '3' } });
      return wikimedia.fetch(input, init);
    };
    const waits: number[] = [];
    const { awards } = await client(throttled, waits).awardsByTmdbIds([2756]);

    assert.equal(calls, 2);
    assert.deepEqual(waits, [3000]);
    assert.ok(awards.has(2756));
  });

  test('429 depois das novas tentativas, fora do ar ou fora do formato: SourceUnavailableError', async () => {
    const waits: number[] = [];
    await assert.rejects(
      client(respondWith('devagar', { status: 429 }), waits).awardsByTmdbIds([2756]),
      SourceUnavailableError,
    );
    assert.deepEqual(waits, [2000, 4000]);
    await assert.rejects(client(respondWith('fora', { status: 503 })).awardsByTmdbIds([2756]), SourceUnavailableError);
    await assert.rejects(client(respondWith({ results: 'x' })).awardsByTmdbIds([2756]), SourceUnavailableError);
  });
});

describe('Wikidata: personAwardsByTmdbIds', () => {
  test('pessoas por P4985, sem o artigo; categorias em português e Framboesa de Ouro', async () => {
    const wikimedia = fakeWikimedia();
    const awards = await client(wikimedia.fetch).personAwardsByTmdbIds([2710, 37917, 11288]);

    const query = wikimedia.requests[0]?.searchParams.get('query') ?? '';
    assert.ok(query.includes('P4985') && !query.includes('schema:about'));

    const cameron = awards.get(2710) ?? [];
    assert.ok(cameron.some((item) => item.org === 'Oscar' && item.cat === 'melhor direção' && item.year === 1998));
    assert.ok(cameron.some((item) => item.org === 'Saturn' && item.cat === 'melhor direção'));
    assert.ok(cameron.some((item) => item.org === 'Framboesa de Ouro' && item.cat === 'pior roteiro'));
    // MTV, Calçada da Fama e Ordem do Canadá não são premiações de cinema da lista.
    const stewart = awards.get(37917) ?? [];
    assert.ok(stewart.every((item) => !/mtv/i.test(item.org)));
    assert.ok(
      stewart.some((item) => item.org === 'Framboesa de Ouro' && item.cat === 'pior atriz' && item.kind === 'win'),
    );
  });
});

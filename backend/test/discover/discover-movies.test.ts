import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { DETAILED_RESULTS, discoverMovies } from '../../lib/discover/discover-movies.js';
import { createTmdbDiscoverClient, type TmdbDiscoverClient } from '../../lib/discover/tmdb-discover-client.js';
import type { SourceName } from '../../lib/types/sources.js';
import type { UsageOutcome, UsageRecorder } from '../../lib/types/usage.js';
import { discoverFetch } from './discover-fixtures.js';

/** Sem lista a busca não lê o banco; um acesso a ele falha o teste. */
const noDatabase = new Proxy(
  {},
  {
    get() {
      throw new Error('a busca sem lista não deveria ler o banco');
    },
  },
) as Firestore;

/** Medidor de consumo que só conta, para conferir quantos pedidos a busca fez a cada fonte. */
class CountingUsage implements UsageRecorder {
  readonly counts: Partial<Record<SourceName, Partial<Record<UsageOutcome, number>>>> = {};

  /**
   * Soma 1 a um contador da fonte.
   *
   * @param source - Fonte externa.
   * @param outcome - Contador.
   */
  count(source: SourceName, outcome: UsageOutcome): void {
    const outcomes = this.counts[source] ?? {};
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    this.counts[source] = outcomes;
  }

  /**
   * Faz a chamada contando o pedido e, se falhar, o erro.
   *
   * @param source - Fonte chamada.
   * @param call - Chamada.
   * @returns O que a chamada devolveu.
   * @throws O erro da chamada, depois de contado.
   */
  async track<T>(source: SourceName, call: () => Promise<T>): Promise<T> {
    this.count(source, 'calls');
    try {
      return await call();
    } catch (error) {
      this.count(source, 'errors');
      throw error;
    }
  }

  /** A busca não usa o Gemini: não conta nada. */
  countGeminiModel(): void {}

  /** A busca não usa o Gemini: não conta nada. */
  countGeminiPurpose(): void {}

  /** A busca não usa o Gemini: nada a pular. */
  skipGeminiModel(): void {}

  /**
   * A busca não usa o Gemini: nenhum modelo a pular.
   *
   * @returns Conjunto vazio.
   */
  async geminiModelsToSkip(): Promise<ReadonlySet<string>> {
    return new Set();
  }

  /**
   * A busca não usa o Gemini: nenhum 429.
   *
   * @returns Lista vazia.
   */
  geminiQuotaHits(): string[] {
    return [];
  }
}

describe('discoverMovies sem lista', () => {
  test('página do TMDb ordenada pela nota do TMDb, com detalhes nos 10 primeiros', async () => {
    const tmdb = discoverFetch();
    const usage = new CountingUsage();
    const client = createTmdbDiscoverClient({ token: 't', fetch: tmdb.fetch });

    const page = await discoverMovies(
      { db: noDatabase, tmdb: client, usage },
      { filters: { genre: ['Comédia'], theme: ['lgbt'] }, page: 1 },
    );

    assert.equal(page.page, 1);
    assert.equal(page.totalPages, 14);
    assert.equal(page.results.length, 20);
    const scores = page.results.map((item) => item.score);
    assert.deepEqual(
      scores,
      [...scores].sort((a, b) => b - a),
    );
    const [first] = page.results;
    assert.deepEqual(first, {
      tmdbId: 490132,
      title: 'Green Book: O Guia',
      year: 2018,
      posterPath: '/u9dldwRwQjTZGlIxKaAtAPLAjOv.jpg',
      runtime: 131,
      genres: ['Drama', 'Comédia', 'História'],
      providers: ['Amazon Prime Video'],
      score: 82,
      reason: 'Nota do TMDb',
      trending: false,
      inListEntryId: null,
      matchedKeywords: [],
    });
    assert.equal(page.results.filter((item) => item.runtime !== null).length, DETAILED_RESULTS);

    const discoverUrl = tmdb.urls.find((url) => url.pathname === '/3/discover/movie');
    assert.equal(discoverUrl?.searchParams.get('with_genres'), '35');
    assert.equal(discoverUrl?.searchParams.get('with_keywords'), '158718|264386|250606|290527|363345');
    // 1 /discover + 1 em alta + 10 detalhes
    assert.deepEqual(usage.counts, { tmdb: { calls: 12 } });
  });

  test('marca os filmes em alta; falha nos em alta ou nos detalhes não derruba a busca', async () => {
    const tmdb = discoverFetch();
    const real = createTmdbDiscoverClient({ token: 't', fetch: tmdb.fetch });
    const client: TmdbDiscoverClient = {
      ...real,
      // Finge que Festa da Salsicha (223702), da página gravada, está em alta.
      trendingWeek: async () => (await real.discover(new URLSearchParams())).results.filter((m) => m.tmdbId === 223702),
    };

    const page = await discoverMovies(
      { db: noDatabase, tmdb: client, usage: new CountingUsage() },
      { filters: {}, page: 1 },
    );
    assert.deepEqual(
      page.results.filter((item) => item.trending).map((item) => item.tmdbId),
      [223702],
    );

    tmdb.failing.add('trending');
    tmdb.failing.add('extras');
    const usage = new CountingUsage();
    const degraded = await discoverMovies({ db: noDatabase, tmdb: real, usage }, { filters: {}, page: 1 });
    assert.equal(degraded.results.length, 20);
    assert.ok(degraded.results.every((item) => !item.trending && item.runtime === null && item.providers.length === 0));
    assert.deepEqual(usage.counts, { tmdb: { calls: 12, errors: 11 } });
  });

  test('duração: tira os filmes cujos detalhes ficam fora da faixa pedida', async () => {
    const tmdb = discoverFetch();
    const client = createTmdbDiscoverClient({ token: 't', fetch: tmdb.fetch });
    const page = await discoverMovies(
      { db: noDatabase, tmdb: client, usage: new CountingUsage() },
      { filters: { dur: ['ate90'] }, page: 1 },
    );
    // Dos 10 com detalhes, só ficam os de até 90 min; os outros 10 não têm duração conhecida e ficam.
    assert.ok(page.results.every((item) => item.runtime === null || item.runtime <= 90));
    assert.ok(page.results.length < 20);
  });

  test('"só o que combina" sem lista não filtra nada', async () => {
    const tmdb = discoverFetch();
    const client = createTmdbDiscoverClient({ token: 't', fetch: tmdb.fetch });
    const page = await discoverMovies(
      { db: noDatabase, tmdb: client, usage: new CountingUsage() },
      { filters: { fit: true }, page: 1 },
    );
    assert.equal(page.results.length, 20);
  });

  test('humor junto com gênero é conferido nos gêneros de cada resultado', async () => {
    const tmdb = discoverFetch();
    const client = createTmdbDiscoverClient({ token: 't', fetch: tmdb.fetch });
    const page = await discoverMovies(
      { db: noDatabase, tmdb: client, usage: new CountingUsage() },
      { filters: { genre: ['Comédia'], mood: ['tenso'] }, page: 1 },
    );
    // Na página gravada, só Acampamento Miasma (Terror), Honey, Não! e Saltburn (Thriller) são tensos.
    assert.deepEqual(page.results.map((item) => item.tmdbId).sort(), [1149504, 1240889, 930564].sort());
  });
});

describe('discoverMovies com palavras-chave do texto', () => {
  test('pede as palavras com "ou" e põe primeiro quem tem mais delas; no empate, a nota', async () => {
    const candidate = (tmdbId: number, vote: number) => ({
      tmdbId,
      title: `Filme ${tmdbId}`,
      year: 2000,
      posterPath: null,
      genreIds: [35],
      vote,
      votes: 500,
      popularity: 10,
    });
    const keywordsOf: Record<number, number[]> = { 1: [], 2: [15097], 3: [15097, 931] };
    let params: URLSearchParams | undefined;
    const tmdb: TmdbDiscoverClient = {
      async discover(sent) {
        params = sent;
        return { page: 1, totalPages: 1, results: [candidate(1, 9), candidate(2, 6), candidate(3, 5)] };
      },
      async trendingWeek() {
        return [];
      },
      async movieExtras(tmdbId) {
        return { runtime: 100, providers: [], keywords: [], keywordIds: keywordsOf[tmdbId] ?? [] };
      },
      async searchKeyword() {
        return [];
      },
    };

    const page = await discoverMovies(
      { db: noDatabase, tmdb, usage: new CountingUsage() },
      { filters: { kw: [15097, 931] }, page: 1 },
    );

    assert.equal(params?.get('with_keywords'), '15097|931');
    assert.deepEqual(
      page.results.map((item) => [item.tmdbId, item.matchedKeywords]),
      [
        [3, [15097, 931]],
        [2, [15097]],
        [1, []],
      ],
    );
  });
});

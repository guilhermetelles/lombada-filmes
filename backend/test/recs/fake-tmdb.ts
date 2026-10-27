import { readFileSync } from 'node:fs';
import type { Fetch } from '../../lib/types/sources.js';

/** O que um filme falso do TMDb muda em relação à gravação de The Abyss. */
export type FakeMovie = {
  title?: string;
  year?: number;
  genres?: string[];
  keywords?: string[];
  recs?: number[];
  collection?: { id: number; name: string } | null;
  directors?: { id: number; name: string }[];
  vote?: number;
};

/** Uma saga falsa: os filmes dela, com a data de estreia. */
export type FakeCollection = { parts: { id: number; title: string; release_date: string }[] };

/** Uma palavra-chave falsa: o id no TMDb e os filmes que o /discover devolve com ela. */
export type FakeKeyword = { id: number; movies: number[] };

/** O fetch falso do TMDb e o que ele registra. */
export type FakeTmdb = {
  fetch: Fetch;
  /** Ids pedidos em /movie/{id}, na ordem. */
  movieCalls: number[];
  /** Ids pedidos em /collection/{id}, na ordem. */
  collectionCalls: number[];
  /** Pedidos a /trending e a /discover. */
  listCalls: string[];
  /** Pedidos a hosts que não são do TMDb (devem ficar vazios: nada de OMDb nem Letterboxd). */
  otherHosts: string[];
};

/** Gravações usadas como molde. */
const fixtures = {
  movie: readFixture('tmdb-movie-2756.json'),
  trending: readFixture('discover-trending-week.json'),
  discover: readFixture('discover-comedia-lgbt.json'),
};

/**
 * Cria um fetch falso do TMDb para o motor de sugestões: /movie/{id} responde a gravação de The
 * Abyss com id, título, gêneros, palavras-chave, recomendações, saga, diretores e nota trocados
 * pelo que o teste passar (qualquer outro id recebe a gravação só com o id trocado); /trending e
 * /discover respondem as gravações da busca avançada; /collection/{id} responde a saga passada
 * (404 para as outras); /search/keyword acha as palavras-chave passadas, e /discover com
 * with_keywords devolve os filmes delas.
 *
 * @param movies - Filmes falsos, por id.
 * @param collections - Sagas falsas, por id.
 * @param keywords - Palavras-chave falsas, pelo nome em inglês.
 * @returns O fetch e os registros.
 */
export function fakeTmdb(
  movies: Record<number, FakeMovie> = {},
  collections: Record<number, FakeCollection> = {},
  keywords: Record<string, FakeKeyword> = {},
): FakeTmdb {
  const movieCalls: number[] = [];
  const collectionCalls: number[] = [];
  const listCalls: string[] = [];
  const otherHosts: string[] = [];

  const fetch: Fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname !== 'api.themoviedb.org') {
      otherHosts.push(url.hostname);
      return new Response('fora do teste', { status: 503 });
    }
    const movieMatch = /^\/3\/movie\/(\d+)$/.exec(url.pathname);
    if (movieMatch) {
      const tmdbId = Number(movieMatch[1]);
      movieCalls.push(tmdbId);
      return json(buildMovie(tmdbId, movies[tmdbId] ?? {}));
    }
    const collectionMatch = /^\/3\/collection\/(\d+)$/.exec(url.pathname);
    const collection = collectionMatch ? collections[Number(collectionMatch[1])] : undefined;
    if (collectionMatch) {
      collectionCalls.push(Number(collectionMatch[1]));
      if (collection) return json({ id: Number(collectionMatch[1]), name: 'Saga de Teste', ...collection });
    }
    if (url.pathname.startsWith('/3/trending/')) {
      listCalls.push('trending');
      return json(fixtures.trending);
    }
    if (url.pathname === '/3/search/keyword') {
      const query = url.searchParams.get('query') ?? '';
      const keyword = keywords[query];
      listCalls.push(`search/keyword?${query}`);
      return json({ page: 1, results: keyword ? [{ id: keyword.id, name: query }] : [], total_pages: 1 });
    }
    if (url.pathname === '/3/discover/movie') {
      listCalls.push(`discover?${url.searchParams}`);
      const keywordId = Number(url.searchParams.get('with_keywords'));
      const keyword = Object.values(keywords).find((candidate) => candidate.id === keywordId);
      if (keyword) return json(discoverPage(keyword.movies));
      return json(fixtures.discover);
    }
    return new Response('{"status_message":"not found"}', { status: 404 });
  };

  return { fetch, movieCalls, collectionCalls, listCalls, otherHosts };
}

/**
 * Monta a resposta de /movie/{id} a partir da gravação de The Abyss.
 *
 * @param tmdbId - Id pedido.
 * @param movie - O que trocar.
 * @returns O corpo da resposta.
 */
function buildMovie(tmdbId: number, movie: FakeMovie): Record<string, unknown> {
  const base = structuredClone(fixtures.movie) as Record<string, unknown>;
  const credits = base.credits as { crew: unknown[]; cast: unknown[] };
  return {
    ...base,
    id: tmdbId,
    title: movie.title ?? `Filme ${tmdbId}`,
    original_title: movie.title ?? `Filme ${tmdbId}`,
    release_date: `${movie.year ?? 2001}-05-01`,
    genres: (movie.genres ?? ['Aventura']).map((name, index) => ({ id: index + 1, name })),
    keywords: { keywords: (movie.keywords ?? []).map((name, index) => ({ id: index + 1, name })) },
    recommendations: { results: (movie.recs ?? []).map((id) => ({ id, title: `Filme ${id}` })) },
    belongs_to_collection: movie.collection ?? null,
    vote_average: movie.vote ?? 6.5,
    vote_count: 1000,
    credits: {
      ...credits,
      crew: (movie.directors ?? [{ id: 9000 + tmdbId, name: `Diretor ${tmdbId}` }]).map(({ id, name }) => ({
        id,
        name,
        job: 'Director',
        department: 'Directing',
        profile_path: null,
      })),
    },
  };
}

/**
 * Monta uma página do /discover com os filmes pedidos, a partir do primeiro da gravação.
 *
 * @param tmdbIds - Filmes da página.
 * @returns O corpo da resposta.
 */
function discoverPage(tmdbIds: readonly number[]): Record<string, unknown> {
  const page = fixtures.discover as { results: Record<string, unknown>[] };
  const template = page.results[0] ?? {};
  const results = tmdbIds.map((id) => ({
    ...template,
    id,
    title: `Filme ${id}`,
    original_title: `Filme ${id}`,
    release_date: '2001-05-01',
  }));
  return { page: 1, results, total_pages: 1, total_results: results.length };
}

/**
 * Resposta JSON.
 *
 * @param body - Corpo.
 * @returns A resposta.
 */
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

/**
 * Lê uma gravação de test/fixtures/.
 *
 * @param name - Nome do arquivo.
 * @returns O conteúdo como objeto.
 */
function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
}

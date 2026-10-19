import type * as z from 'zod';
import { TmdbKeywordSearchResponse, TmdbMovieExtrasResponse, TmdbMoviePage } from '../schemas/sources/tmdb-discover.js';
import { fetchJson } from '../sources/shared/fetch-json.js';
import type { Fetch } from '../types/sources.js';
import { STREAMING_SERVICES } from './discover-vocabulary.js';
import { normalizeStreamingServices } from './streaming-names.js';

/** Endereço da API v3 do TMDb; o token vai no cabeçalho Authorization. */
const BASE_URL = 'https://api.themoviedb.org/3';

/** Um filme de uma lista do TMDb, com o que a busca avançada usa para mostrar e pontuar. */
export type DiscoverCandidate = {
  tmdbId: number;
  title: string; // no idioma pedido (pt-BR por padrão) quando o TMDb tem tradução
  titleEn?: string | undefined; // título original, quando o idioma original é inglês
  year: number | null;
  posterPath: string | null;
  genreIds: number[];
  vote: number | null; // nota média do TMDb, 0 a 10
  votes: number; // quantos votos
  popularity: number;
};

/** Uma página de filmes do TMDb. */
export type CandidatePage = { page: number; totalPages: number; results: DiscoverCandidate[] };

/** O que só os detalhes do filme trazem: duração, streaming por assinatura no Brasil e palavras-chave. */
export type CandidateExtras = {
  runtime: number | null;
  providers: string[]; // serviços conhecidos (STREAMING_SERVICES), com o nome do TMDb, como "Netflix"
  keywords: string[]; // nomes em inglês, como no TMDb
  keywordIds?: number[] | undefined; // ids das mesmas palavras-chave, quando lidos do TMDb
};

/** Uma palavra-chave do TMDb. */
export type TmdbKeyword = { id: number; name: string };

/** Cliente do TMDb para a busca avançada: /discover, filmes em alta e os detalhes de um filme. */
export type TmdbDiscoverClient = {
  discover(params: URLSearchParams): Promise<CandidatePage>;
  trendingWeek(): Promise<DiscoverCandidate[]>;
  movieExtras(tmdbId: number): Promise<CandidateExtras>;
  searchKeyword(query: string): Promise<TmdbKeyword[]>;
};

/**
 * Cria o cliente do TMDb da busca avançada.
 *
 * @param options - Token de leitura do TMDb e o fetch a usar.
 * @returns Cliente com /discover/movie, /trending/movie/week e os detalhes de um filme.
 */
function createTmdbDiscoverClient({ token, fetch }: { token: string; fetch: Fetch }): TmdbDiscoverClient {
  const getFromTmdb = <Schema extends z.ZodType>(path: string, schema: Schema) =>
    fetchJson(fetch, 'tmdb', `${BASE_URL}${path}`, schema, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });

  return {
    /**
     * Busca uma página de /discover/movie com os parâmetros já montados (buildDiscoverParams).
     *
     * @param params - Parâmetros do TMDb, com página, região e idioma.
     * @returns A página, com os filmes no formato da busca.
     * @throws {SourceUnavailableError} Se o TMDb falhar ou responder fora do formato.
     */
    async discover(params) {
      const page = await getFromTmdb(`/discover/movie?${params}`, TmdbMoviePage);
      return { page: page.page, totalPages: page.total_pages, results: page.results.map(toCandidate) };
    },

    /**
     * Busca os filmes em alta na semana (primeira página, 20 filmes), em pt-BR.
     *
     * @returns Os filmes em alta.
     * @throws {SourceUnavailableError} Se o TMDb falhar ou responder fora do formato.
     */
    async trendingWeek() {
      const page = await getFromTmdb('/trending/movie/week?language=pt-BR', TmdbMoviePage);
      return page.results.map(toCandidate);
    },

    /**
     * Busca duração, streaming por assinatura no Brasil e palavras-chave de um filme, numa chamada.
     * Do streaming ficam só os serviços conhecidos, sem as variações "with Ads" e os canais.
     *
     * @param tmdbId - Id do filme no TMDb.
     * @returns Os detalhes que a lista do /discover não traz.
     * @throws {NotFoundError} Se o TMDb não tiver o filme.
     * @throws {SourceUnavailableError} Se o TMDb falhar ou responder fora do formato.
     */
    async movieExtras(tmdbId) {
      const path = `/movie/${tmdbId}?language=pt-BR&append_to_response=watch/providers,keywords`;
      const movie = await getFromTmdb(path, TmdbMovieExtrasResponse);
      return {
        runtime: movie.runtime || null,
        providers: knownServices(movie['watch/providers']?.results.BR?.flatrate ?? []),
        keywords: (movie.keywords?.keywords ?? []).map((keyword) => keyword.name),
        keywordIds: (movie.keywords?.keywords ?? []).map((keyword) => keyword.id),
      };
    },

    async searchKeyword(query) {
      const found = await getFromTmdb(
        `/search/keyword?${new URLSearchParams({ query, page: '1' })}`,
        TmdbKeywordSearchResponse,
      );
      return found.results.map(({ id, name }) => ({ id, name }));
    },
  };
}

/**
 * Converte um filme de lista do TMDb para o formato da busca.
 *
 * @param movie - Filme como o TMDb devolve.
 * @returns O candidato.
 */
function toCandidate(movie: z.output<typeof TmdbMoviePage>['results'][number]): DiscoverCandidate {
  const year = movie.release_date && /^\d{4}/.test(movie.release_date) ? Number(movie.release_date.slice(0, 4)) : null;
  const titleEn = movie.original_language === 'en' ? movie.original_title : null;
  return {
    tmdbId: movie.id,
    title: movie.title ?? movie.original_title ?? '',
    ...(titleEn ? { titleEn } : {}),
    year,
    posterPath: movie.poster_path,
    genreIds: movie.genre_ids,
    vote: movie.vote_count ? (movie.vote_average ?? null) : null,
    votes: movie.vote_count ?? 0,
    popularity: movie.popularity ?? 0,
  };
}

/**
 * Nomes dos serviços conhecidos entre os que o TMDb lista, sem repetidos, na ordem de STREAMING_SERVICES.
 *
 * @param providers - Serviços por assinatura do filme no Brasil, como o TMDb devolve.
 * @returns Os nomes dos conhecidos.
 */
function knownServices(providers: readonly { provider_id: number }[]): string[] {
  const ids = new Set(providers.map((provider) => provider.provider_id));
  // Os nomes vêm de STREAMING_SERVICES, já únicos; a normalização garante o mesmo formato do enrich.
  return normalizeStreamingServices(
    STREAMING_SERVICES.filter((service) => ids.has(service.id)).map((service) => service.name),
  );
}

export { createTmdbDiscoverClient };

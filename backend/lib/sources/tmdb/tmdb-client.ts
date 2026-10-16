import type * as z from 'zod';
import { TmdbMovieResponse, TmdbSearchResponse } from '../../schemas/sources/tmdb.js';
import type { Fetch, TmdbClient } from '../../types/sources.js';
import { fetchJson } from '../shared/fetch-json.js';
import { toTmdbMovie, toTmdbSearchResults } from './tmdb-mappers.js';

const BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Cria o cliente do TMDb.
 *
 * @param options - Token de leitura do TMDb e o fetch a usar.
 * @returns Cliente com detalhes de filme e busca.
 */
function createTmdbClient({ token, fetch }: { token: string; fetch: Fetch }): TmdbClient {
  const getFromTmdb = <Schema extends z.ZodType>(path: string, schema: Schema) =>
    fetchJson(fetch, 'tmdb', `${BASE_URL}${path}`, schema, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });

  return {
    /**
     * Busca um filme numa chamada só: detalhes em pt-BR (gêneros e sinopse em português) com
     * diretores, ids externos e a tradução em inglês (título e sinopse em inglês).
     *
     * @param tmdbId - Id do filme no TMDb.
     * @returns O filme no formato do app.
     * @throws {NotFoundError} Se o TMDb não tiver o filme.
     * @throws {SourceUnavailableError} Se o TMDb falhar ou responder fora do formato.
     */
    async getMovie(tmdbId) {
      const path = `/movie/${tmdbId}?language=pt-BR&append_to_response=credits,external_ids,translations`;
      return toTmdbMovie(await getFromTmdb(path, TmdbMovieResponse));
    },

    /**
     * Busca filmes por texto, em pt-BR e sem conteúdo adulto.
     *
     * @param query - Texto digitado.
     * @returns Resultados resumidos para a lista de busca.
     * @throws {SourceUnavailableError} Se o TMDb falhar ou responder fora do formato.
     */
    async search(query) {
      const params = new URLSearchParams({ query, language: 'pt-BR', include_adult: 'false' });
      return toTmdbSearchResults(await getFromTmdb(`/search/movie?${params}`, TmdbSearchResponse));
    },
  };
}

export { createTmdbClient };

import type * as z from 'zod';
import {
  TmdbCreditsResponse,
  TmdbMovieResponse,
  TmdbPersonResponse,
  TmdbPersonSearchResponse,
  TmdbSearchResponse,
} from '../../schemas/sources/tmdb.js';
import type { Fetch, TmdbClient } from '../../types/sources.js';
import { fetchJson } from '../shared/fetch-json.js';
import { toCast, toTmdbMovie, toTmdbSearchResults } from './tmdb-mappers.js';
import { toTmdbPerson, toTmdbPersonSearchResults } from './tmdb-person-mapper.js';

/** Endereço da API v3 do TMDb; o token vai no cabeçalho Authorization. */
const BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Cria o cliente do TMDb.
 *
 * @param options - Token de leitura do TMDb e o fetch a usar.
 * @returns Cliente com detalhes de filme, busca de filmes e de pessoas, detalhes de pessoa e elenco.
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

    /**
     * Busca uma pessoa numa chamada só: dados em inglês (títulos dos filmes como no resto do app),
     * filmes em que trabalhou, ids externos e as traduções, de onde sai a biografia em português.
     *
     * @param personId - Id de pessoa no TMDb.
     * @returns A pessoa com biografia, nascimento, foto e os filmes que dirigiu.
     * @throws {NotFoundError} Se o TMDb não tiver a pessoa.
     * @throws {SourceUnavailableError} Se o TMDb falhar ou responder fora do formato.
     */
    async getPerson(personId) {
      const path = `/person/${personId}?language=en-US&append_to_response=movie_credits,external_ids,translations`;
      return toTmdbPerson(await getFromTmdb(path, TmdbPersonResponse));
    },

    /**
     * Busca só o elenco de um filme (usado na recarga do elenco, sem mexer no resto do filme).
     *
     * @param tmdbId - Id do filme no TMDb.
     * @returns Os 12 primeiros dos créditos.
     * @throws {NotFoundError} Se o TMDb não tiver o filme.
     * @throws {SourceUnavailableError} Se o TMDb falhar ou responder fora do formato.
     */
    async getCast(tmdbId) {
      const { cast } = await getFromTmdb(`/movie/${tmdbId}/credits`, TmdbCreditsResponse);
      return toCast(cast);
    },

    /**
     * Busca pessoas por nome, em pt-BR e sem conteúdo adulto.
     *
     * @param query - Texto digitado.
     * @returns Até 5 pessoas conhecidas por atuar ou dirigir.
     * @throws {SourceUnavailableError} Se o TMDb falhar ou responder fora do formato.
     */
    async searchPeople(query) {
      const params = new URLSearchParams({ query, language: 'pt-BR', include_adult: 'false' });
      return toTmdbPersonSearchResults(await getFromTmdb(`/search/person?${params}`, TmdbPersonSearchResponse));
    },
  };
}

export { createTmdbClient };

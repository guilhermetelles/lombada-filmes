import { SourceUnavailableError } from '../../errors/app-errors.js';
import { OmdbResponse, omdbNumber } from '../../schemas/sources/omdb.js';
import type { Fetch, OmdbClient, OmdbRatings } from '../../types/sources.js';
import { fetchJson } from '../shared/fetch-json.js';
import { translateAwardsSummary } from './translate-awards-summary.js';

/** Endereço da OMDb; a chave vai na query. */
const BASE_URL = 'https://www.omdbapi.com/';

/** Resposta para filme que a OMDb não tem: as três notas vazias. */
const NO_RATINGS: OmdbRatings = {
  imdb: { value: null, votes: null },
  rottenTomatoes: { value: null, url: null },
  metacritic: { value: null },
  awardsSummary: null,
  boxOfficeUS: null,
};

/**
 * Cria o cliente da OMDb, que traz IMDb, Rotten Tomatoes (com o link), Metacritic, o resumo de
 * prêmios e a bilheteria nos EUA numa chamada só.
 *
 * @param options - Chave da OMDb e o fetch a usar.
 * @returns Cliente de notas por id do IMDb.
 */
function createOmdbClient({ apiKey, fetch }: { apiKey: string; fetch: Fetch }): OmdbClient {
  return {
    /**
     * Busca as notas de um filme. "Movie not found!" não é falha: devolve as notas vazias.
     *
     * @param imdbId - Id do filme no IMDb (tt…).
     * @returns Notas do IMDb, do Rotten Tomatoes e do Metacritic, resumo de prêmios em português e
     *   bilheteria nos EUA; null onde a OMDb não tem.
     * @throws {SourceUnavailableError} Se a OMDb falhar, recusar o pedido (como cota estourada) ou responder fora do formato.
     */
    async getRatings(imdbId) {
      const params = new URLSearchParams({ i: imdbId, tomatoes: 'true', apikey: apiKey });
      const body = await fetchJson(fetch, 'omdb', `${BASE_URL}?${params}`, OmdbResponse);

      if (body.Response === 'False') {
        // "Movie not found!" não é falha: a OMDb não tem notas para esse filme.
        if (/not found/i.test(body.Error)) return NO_RATINGS;
        throw new SourceUnavailableError('omdb', body.Error);
      }

      const rottenTomatoes = body.Ratings.find((rating) => rating.Source === 'Rotten Tomatoes');
      return {
        imdb: { value: body.imdbRating, votes: body.imdbVotes },
        rottenTomatoes: {
          value: omdbNumber.parse(rottenTomatoes?.Value),
          url: body.tomatoURL?.startsWith('http') ? body.tomatoURL : null,
        },
        metacritic: { value: body.Metascore },
        awardsSummary: translateAwardsSummary(body.Awards),
        boxOfficeUS: body.BoxOffice,
      };
    },
  };
}

export { createOmdbClient };

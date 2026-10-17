import { DAY_MS } from '../time/durations.js';
import type { Movie } from '../types/movie.js';
import type { SourceName } from '../types/sources.js';

/**
 * Notas são buscadas de novo só depois de 7 dias. Mudam pouco, e isso mantém a OMDb muito abaixo
 * da cota de 1.000 pedidos por dia.
 */
const FRESHNESS_MS = 7 * DAY_MS;

/** Fontes de nota, as únicas que vencem por tempo. */
type RatingSource = Exclude<SourceName, 'tmdb'>;

/**
 * Quando cada fonte de nota foi buscada pela última vez. A OMDb traz IMDb, Rotten Tomatoes e
 * Metacritic juntos, então a data da nota do IMDb vale pelas três.
 */
const LAST_RATING_FETCH: Record<RatingSource, (movie: Movie) => Date | undefined> = {
  letterboxd: (movie) => movie.ratings.letterboxd?.fetchedAt,
  omdb: (movie) => movie.ratings.imdb?.fetchedAt,
};

/**
 * Diz se uma fonte precisa ser buscada. O TMDb (catálogo, diretores e elenco) quase nunca muda: só
 * é buscado quando o filme ainda não está guardado. As notas vencem aos 7 dias.
 *
 * @param movie - Documento guardado, se existir.
 * @param source - Fonte a conferir.
 * @param now - Momento de referência.
 * @returns true se a fonte estiver vencida.
 */
function isStale(movie: Movie | undefined, source: SourceName, now: Date): boolean {
  if (!movie) return true;
  if (source === 'tmdb') return false;
  const fetchedAt = LAST_RATING_FETCH[source](movie);
  if (!fetchedAt) return true;
  return now.getTime() - fetchedAt.getTime() >= FRESHNESS_MS;
}

/**
 * Diz se alguma nota do filme venceu, com a mesma regra da busca: a OMDb só conta quando o filme
 * tem id do IMDb, porque sem ele não há o que pedir.
 *
 * @param movie - Documento guardado.
 * @param now - Momento de referência.
 * @returns true se o Letterboxd ou (com id do IMDb) a OMDb estiverem vencidos.
 */
function needsRefresh(movie: Movie, now: Date): boolean {
  return isStale(movie, 'letterboxd', now) || (movie.ids.imdb !== null && isStale(movie, 'omdb', now));
}

/**
 * Data da nota mais antiga do filme, para atualizar primeiro o que está há mais tempo sem busca.
 * Nota nunca buscada conta como a mais antiga possível; sem id do IMDb, a OMDb não conta.
 *
 * @param movie - Documento guardado.
 * @returns A menor data de busca entre as notas que contam (data zero para nota nunca buscada).
 */
function oldestRatingFetch(movie: Movie): Date {
  const sources: RatingSource[] = movie.ids.imdb === null ? ['letterboxd'] : ['letterboxd', 'omdb'];
  const times = sources.map((source) => LAST_RATING_FETCH[source](movie)?.getTime() ?? 0);
  return new Date(Math.min(...times));
}

export { FRESHNESS_MS, isStale, needsRefresh, oldestRatingFetch };

import type { Movie } from '../types/movie.js';
import type { SourceName } from '../types/sources.js';

/**
 * Cada fonte é buscada de novo só depois de 7 dias. Notas mudam pouco, e isso mantém a OMDb muito
 * abaixo da cota de 1.000 pedidos por dia.
 */
const FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Quando cada fonte foi buscada pela última vez. A OMDb traz IMDb, Rotten Tomatoes e Metacritic
 * juntos, então a data da nota do IMDb vale pelas três.
 */
const LAST_FETCHED_AT: Record<SourceName, (movie: Movie) => Date | undefined> = {
  tmdb: (movie) => movie.tmdbFetchedAt,
  letterboxd: (movie) => movie.ratings.letterboxd?.fetchedAt,
  omdb: (movie) => movie.ratings.imdb?.fetchedAt,
};

/**
 * Diz se uma fonte precisa ser buscada de novo: nunca buscada, ou buscada há 7 dias ou mais.
 *
 * @param movie - Documento guardado, se existir.
 * @param source - Fonte a conferir.
 * @param now - Momento de referência.
 * @returns true se a fonte estiver vencida.
 */
function isStale(movie: Movie | undefined, source: SourceName, now: Date): boolean {
  const fetchedAt = movie ? LAST_FETCHED_AT[source](movie) : undefined;
  if (!fetchedAt) return true;
  return now.getTime() - fetchedAt.getTime() >= FRESHNESS_MS;
}

export { FRESHNESS_MS, isStale };

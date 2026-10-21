import { DAY_MS } from '../time/durations.js';
import type { Movie } from '../types/movie.js';
import type { WeeklySource } from '../types/sources.js';

/**
 * Cada fonte é buscada de novo só depois de 7 dias. Notas mudam pouco, e isso mantém a OMDb muito
 * abaixo da cota de 1.000 pedidos por dia.
 */
const FRESHNESS_MS = 7 * DAY_MS;

/** Fontes de nota, as únicas que a rotina diária atualiza por aqui. */
type RatingSource = Exclude<WeeklySource, 'tmdb'>;

/**
 * Quando cada fonte de nota foi buscada pela última vez. A OMDb traz IMDb, Rotten Tomatoes e
 * Metacritic juntos, então a data da nota do IMDb vale pelas três.
 */
const LAST_RATING_FETCH: Record<RatingSource, (movie: Movie) => Date | undefined> = {
  letterboxd: (movie) => movie.ratings.letterboxd?.fetchedAt,
  omdb: (movie) => movie.ratings.imdb?.fetchedAt,
};

/**
 * Diz se uma fonte precisa ser buscada: nunca buscada, ou buscada há 7 dias ou mais. Vale para o
 * TMDb (catálogo, diretores e elenco com foto) e para as notas. O TMDb também vence quando o filme
 * foi gravado num formato antigo, com dados incompletos.
 *
 * @param movie - Documento guardado, se existir.
 * @param source - Fonte a conferir.
 * @param now - Momento de referência.
 * @returns true se a fonte estiver vencida.
 */
function isStale(movie: Movie | undefined, source: WeeklySource, now: Date): boolean {
  if (!movie) return true;
  if (source === 'tmdb' && hasIncompleteTmdbData(movie)) return true;
  const fetchedAt = source === 'tmdb' ? movie.tmdbFetchedAt : LAST_RATING_FETCH[source](movie);
  if (!fetchedAt) return true;
  return now.getTime() - fetchedAt.getTime() >= FRESHNESS_MS;
}

/**
 * Diz se faltam dados que a busca do TMDb sempre grava: hoje, a foto dos diretores, ausente nos
 * filmes gravados antes do passo 11. Foto `null` (o TMDb não tem) conta como completa, para o filme
 * não ser buscado de novo a cada abertura.
 *
 * @param movie - Documento guardado.
 * @returns true se algum diretor estiver sem o campo profilePath.
 */
function hasIncompleteTmdbData(movie: Movie): boolean {
  return movie.directors.some((director) => director.profilePath === undefined);
}

/**
 * Diz se alguma nota do filme venceu, para a rotina diária, que só atualiza notas. A OMDb só conta
 * quando o filme tem id do IMDb, porque sem ele não há o que pedir.
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

/**
 * Campos extras (curiosidades, onde assistir, prêmios) são buscados de novo só depois de 30 dias:
 * mudam pouco, e a rotina enrich cobre os filmes das listas e da fila.
 */
const EXTRA_FRESHNESS_MS = 30 * DAY_MS;

/**
 * Diz se os campos extras de movies/{tmdbId} (TMDb extra, resumo de prêmios e bilheteria da OMDb)
 * precisam ser buscados: nunca buscados, ou buscados há 30 dias ou mais.
 *
 * @param movie - Documento guardado.
 * @param now - Momento de referência.
 * @returns true se `extraFetchedAt` faltar ou tiver vencido.
 */
function isExtraStale(movie: Movie, now: Date): boolean {
  // Filme buscado antes de `streamingFirst` (2026-10-19) ou de `trailer` (2026-10-21) existir também
  // conta como vencido.
  if (movie.streamingFirst === undefined || movie.trailer === undefined) return true;
  return !movie.extraFetchedAt || now.getTime() - movie.extraFetchedAt.getTime() >= EXTRA_FRESHNESS_MS;
}

/**
 * Diz se os prêmios (Wikidata e Wikipedia) precisam ser buscados: nunca buscados, ou buscados há 30
 * dias ou mais. Vale para filmes e pessoas.
 *
 * @param document - Filme ou pessoa guardados.
 * @param now - Momento de referência.
 * @returns true se `awards` faltar ou tiver vencido.
 */
function isAwardsStale(document: Pick<Movie, 'awards'>, now: Date): boolean {
  return !document.awards || now.getTime() - document.awards.fetchedAt.getTime() >= EXTRA_FRESHNESS_MS;
}

export { EXTRA_FRESHNESS_MS, FRESHNESS_MS, isAwardsStale, isExtraStale, isStale, needsRefresh, oldestRatingFetch };

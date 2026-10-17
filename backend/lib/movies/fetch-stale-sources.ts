import { logger } from '../logging/logger.js';
import type { FetchedSources, Movie } from '../types/movie.js';
import type { SourceClients, SourceName } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import { isStale } from './freshness.js';

/** Filme, documento guardado, momento, clientes e medidor de consumo de uma busca. */
type FetchContext = {
  tmdbId: number;
  stored: Movie | undefined;
  now: Date;
  sources: SourceClients;
  usage: UsageRecorder;
  ratingsOnly: boolean; // rotina diária: com documento guardado, deixa o TMDb de fora
};

/**
 * Busca só as fontes vencidas. O TMDb vem primeiro porque dá o id do IMDb que a OMDb precisa;
 * Letterboxd e OMDb vão em paralelo. Com `ratingsOnly` e documento guardado, o TMDb fica de fora.
 *
 * @param context - Filme, documento guardado, momento, clientes, medidor de consumo e se busca só notas.
 * @returns O que cada fonte trouxe; fica de fora o que estava fresco ou falhou.
 * @throws {NotFoundError} Se não houver documento guardado e o TMDb não tiver o filme.
 * @throws {SourceUnavailableError} Se não houver documento guardado e o TMDb falhar.
 */
export async function fetchStaleSources(context: FetchContext): Promise<FetchedSources> {
  const { tmdbId, stored, sources, ratingsOnly } = context;

  const tmdb =
    ratingsOnly && stored
      ? undefined
      : await fetchIfStale(context, 'tmdb', () => sources.tmdb.getMovie(tmdbId), {
          // Sem documento guardado não há o que mostrar, então a falha do TMDb chega à rota.
          required: stored === undefined,
        });

  const imdbId = tmdb?.imdbId ?? stored?.ids.imdb ?? null;
  const [letterboxd, omdb] = await Promise.all([
    fetchIfStale(context, 'letterboxd', () => sources.letterboxd.getRating(tmdbId)),
    imdbId ? fetchIfStale(context, 'omdb', () => sources.omdb.getRatings(imdbId)) : undefined,
  ]);

  return { tmdb, letterboxd, omdb };
}

/**
 * Busca uma fonte se ela estiver vencida. Fonte fresca conta como acerto de cache. Fonte que falha
 * é registrada no log e fica de fora (a nota guardada continua valendo), a menos que seja
 * obrigatória.
 *
 * @param context - Documento guardado, momento e medidor de consumo.
 * @param source - Fonte a buscar.
 * @param fetchSource - Chamada à fonte.
 * @param options - `required`: repassa a falha em vez de seguir sem a fonte.
 * @returns O que a fonte trouxe, ou undefined se estava fresca ou falhou.
 * @throws O erro da fonte, quando ela é obrigatória.
 */
async function fetchIfStale<T>(
  { tmdbId, stored, now, usage }: FetchContext,
  source: SourceName,
  fetchSource: () => Promise<T>,
  { required = false } = {},
): Promise<T | undefined> {
  if (!isStale(stored, source, now)) {
    usage.count(source, 'cacheHits');
    return undefined;
  }

  try {
    return await usage.track(source, fetchSource);
  } catch (error) {
    if (required) throw error;
    logger.warn('fonte falhou; mantendo o valor guardado', { source, tmdbId, error });
    return undefined;
  }
}

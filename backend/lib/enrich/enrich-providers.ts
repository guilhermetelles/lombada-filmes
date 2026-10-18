import { logger } from '../logging/logger.js';
import { runInBatches } from '../maintenance/run-in-batches.js';
import { syncEntrySnapshots } from '../movies/entry-snapshots.js';
import { mergeMovie } from '../movies/merge-movie.js';
import { saveMovie } from '../movies/movie-repository.js';
import { toMovieSnapshot } from '../movies/movie-snapshot.js';
import { brazilDay } from '../time/brazil-day.js';
import type { EnrichContext, EnrichCount, PhaseProgress } from '../types/enrich.js';
import { processInOrder } from './process-in-order.js';

/** Quantos filmes buscar no TMDb ao mesmo tempo. */
const CONCURRENCY = 4;

/**
 * Etapa de onde assistir: busca de novo no TMDb os filmes da fila "Quero ver" cujo `providersBR`
 * ainda não foi buscado hoje (Brasília), para a notificação "Chegou no streaming" comparar com o
 * dia anterior. A mesma chamada atualiza o catálogo e os outros campos do TMDb.
 *
 * @param context - Dependências, momento, limites, tempo e filmes guardados.
 * @param queueMovieIds - Filmes da fila, em ordem crescente.
 * @param after - Último filme tratado numa execução anterior do mesmo dia, ou null.
 * @param count - Contadores a atualizar.
 * @returns Até onde a etapa chegou.
 */
async function enrichProviders(
  context: EnrichContext,
  queueMovieIds: number[],
  after: number | null,
  count: EnrichCount,
): Promise<PhaseProgress> {
  const today = brazilDay(context.now);
  const due = queueMovieIds.filter((tmdbId) => {
    const providers = context.movies.get(tmdbId)?.providersBR;
    return !providers || brazilDay(providers.fetchedAt) !== today;
  });

  return processInOrder(due, after, context.limits.batchSize, context.budget, async (batch) => {
    await runInBatches(batch, CONCURRENCY, async (tmdbId) => {
      try {
        const tmdb = await context.usage.track('tmdb', () => context.dependencies.sources.tmdb.getMovie(tmdbId));
        const movie = mergeMovie(context.movies.get(tmdbId), { tmdb }, context.now);
        await saveMovie(context.dependencies.db, tmdbId, movie);
        context.movies.set(tmdbId, movie);
        await syncEntrySnapshots(context.dependencies.db, tmdbId, toMovieSnapshot(movie));
        count.updated++;
      } catch (error) {
        count.failed++;
        logger.warn('rotina enrich: onde assistir não atualizado', { tmdbId, error });
      }
    });
    return batch.length;
  });
}

export { enrichProviders };

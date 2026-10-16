import { logger } from '../logging/logger.js';
import { needsRefresh, oldestFetch } from '../movies/freshness.js';
import { getFreshMovie } from '../movies/get-fresh-movie.js';
import { MovieSchema } from '../schemas/movie.js';
import type { Dependencies } from '../types/dependencies.js';
import type { UsageRecorder } from '../types/usage.js';
import { runInBatches } from './run-in-batches.js';

/** Quantos filmes buscar ao mesmo tempo. */
const CONCURRENCY = 4;

/**
 * Atualiza os filmes com alguma nota vencida, do que está há mais tempo sem busca para o mais
 * recente. Cada atualização também corrige a cópia resumida nas entradas das listas.
 *
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo da execução.
 * @param limit - No máximo quantos filmes nesta execução.
 * @returns Quantos foram atualizados e quantos falharam.
 */
async function refreshStaleMovies(
  dependencies: Dependencies,
  usage: UsageRecorder,
  limit: number,
): Promise<{ refreshed: number; failed: number }> {
  const now = dependencies.now();
  const movies = await dependencies.db.collection('movies').get();
  const stale = movies.docs
    .map((doc) => ({ tmdbId: Number(doc.id), movie: MovieSchema.parse(doc.data()) }))
    .filter(({ movie }) => needsRefresh(movie, now))
    .sort((a, b) => oldestFetch(a.movie).getTime() - oldestFetch(b.movie).getTime())
    .slice(0, limit);

  let failed = 0;
  await runInBatches(stale, CONCURRENCY, async ({ tmdbId }) => {
    try {
      await getFreshMovie(tmdbId, dependencies, usage);
    } catch (error) {
      failed++;
      logger.warn('rotina diária: filme não atualizado', { tmdbId, error });
    }
  });
  return { refreshed: stale.length - failed, failed };
}

export { refreshStaleMovies };

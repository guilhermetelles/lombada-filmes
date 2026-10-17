import { logger } from '../logging/logger.js';
import { needsRefresh, oldestRatingFetch } from '../movies/freshness.js';
import { getFreshMovie } from '../movies/get-fresh-movie.js';
import { MovieSchema } from '../schemas/movie.js';
import type { Dependencies } from '../types/dependencies.js';
import type { RefreshCount } from '../types/maintenance.js';
import type { UsageRecorder } from '../types/usage.js';
import { runInBatches } from './run-in-batches.js';

/** Quantos filmes buscar ao mesmo tempo. */
const CONCURRENCY = 4;

/**
 * Atualiza os filmes com alguma nota vencida, do que está há mais tempo sem busca para o mais
 * recente. Só as notas são buscadas (o TMDb fica para quando alguém abre o filme), e cada atualização
 * também corrige a cópia resumida nas entradas das listas.
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
): Promise<RefreshCount> {
  const now = dependencies.now();
  const movies = await dependencies.db.collection('movies').get();
  const stale = movies.docs
    // Um documento fora do formato não pode derrubar a rotina inteira: fica de fora, registrado.
    .flatMap((doc) => {
      const tmdbId = Number(doc.id);
      const parsed = MovieSchema.safeParse(doc.data());
      if (parsed.success) return [{ tmdbId, movie: parsed.data }];
      logger.warn('rotina diária: filme fora do formato, pulado', { tmdbId });
      return [];
    })
    .filter(({ movie }) => needsRefresh(movie, now))
    .sort((a, b) => oldestRatingFetch(a.movie).getTime() - oldestRatingFetch(b.movie).getTime())
    .slice(0, limit);

  let failed = 0;
  await runInBatches(stale, CONCURRENCY, async ({ tmdbId }) => {
    try {
      await getFreshMovie(tmdbId, dependencies, usage, { ratingsOnly: true });
    } catch (error) {
      failed++;
      logger.warn('rotina diária: filme não atualizado', { tmdbId, error });
    }
  });
  return { refreshed: stale.length - failed, failed };
}

export { refreshStaleMovies };

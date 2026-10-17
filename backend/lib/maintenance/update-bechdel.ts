import { needsBechdelMatch } from '../bechdel/bechdel-freshness.js';
import { createBechdelIndexLoader } from '../bechdel/bechdel-index-loader.js';
import { refreshBechdel } from '../bechdel/refresh-bechdel.js';
import { logger } from '../logging/logger.js';
import {
  type BechdelRatingUpdate,
  listMovies,
  type StoredMovie,
  saveBechdel,
  updateBechdelRatings,
} from '../movies/movie-repository.js';
import type { Dependencies } from '../types/dependencies.js';
import type { BechdelCount } from '../types/maintenance.js';
import type { BechdelIndexEntry } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import { runInBatches } from './run-in-batches.js';

/** Quantas páginas do site ler ao mesmo tempo: o site é pequeno e mantido por voluntários. */
const CONCURRENCY = 2;

/**
 * Passo da rotina diária para o Teste de Bechdel: baixa o índice do site uma vez, atualiza pelo
 * índice os critérios e a duvidosa dos filmes casados (sem pedido por filme, gravando só o que
 * mudou) e tenta casar até `limit` filmes nunca buscados ou não encontrados há 7 dias ou mais.
 *
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo da execução.
 * @param limit - No máximo quantos filmes casar nesta execução.
 * @returns Quantos foram atualizados, casados, não encontrados e quantos falharam.
 */
async function updateBechdel(dependencies: Dependencies, usage: UsageRecorder, limit: number): Promise<BechdelCount> {
  const { db, sources } = dependencies;
  const now = dependencies.now();
  const movies = await listMovies(db);
  const matched = movies.filter(({ movie }) => typeof movie.bechdel?.siteId === 'number');
  const toMatch = movies
    .filter(({ movie }) => needsBechdelMatch(movie, now))
    // Nunca buscados primeiro; depois, os procurados há mais tempo.
    .sort((a, b) => (a.movie.bechdel?.fetchedAt.getTime() ?? 0) - (b.movie.bechdel?.fetchedAt.getTime() ?? 0))
    .slice(0, limit);
  const count: BechdelCount = { updated: 0, matched: 0, notFound: 0, failed: 0 };
  if (matched.length === 0 && toMatch.length === 0) return count;

  const loadIndex = createBechdelIndexLoader(sources.bechdel, usage);
  let index: BechdelIndexEntry[];
  try {
    index = await loadIndex();
  } catch (error) {
    logger.warn('rotina diária: índice do Teste de Bechdel indisponível', { error });
    return { ...count, failed: toMatch.length };
  }

  const changed = changedRatings(matched, index);
  await updateBechdelRatings(db, changed);
  count.updated = changed.length;

  await runInBatches(toMatch, CONCURRENCY, async ({ tmdbId, movie }) => {
    try {
      const { outcome, bechdel } = await refreshBechdel(movie, { client: sources.bechdel, usage, now, loadIndex });
      await saveBechdel(db, tmdbId, bechdel);
      if (outcome === 'notFound') count.notFound++;
      else count.matched++;
    } catch (error) {
      count.failed++;
      logger.warn('rotina diária: Teste de Bechdel não atualizado', { tmdbId, error });
    }
  });
  return count;
}

/**
 * Compara os filmes casados com o índice e devolve os que tiveram critérios ou duvidosa alterados.
 * Um id que sumiu do índice fica como está.
 *
 * @param matched - Filmes casados.
 * @param index - Índice do site.
 * @returns As atualizações a gravar.
 */
function changedRatings(matched: StoredMovie[], index: BechdelIndexEntry[]): BechdelRatingUpdate[] {
  const bySiteId = new Map(index.map((entry) => [entry.siteId, entry]));
  return matched.flatMap(({ tmdbId, movie }) => {
    const siteId = movie.bechdel?.siteId;
    const entry = typeof siteId === 'number' ? bySiteId.get(siteId) : undefined;
    if (!entry || (entry.rating === movie.bechdel?.rating && entry.dubious === movie.bechdel.dubious)) return [];
    return [{ tmdbId, rating: entry.rating, dubious: entry.dubious }];
  });
}

export { updateBechdel };

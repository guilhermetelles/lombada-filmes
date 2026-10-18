import { logger } from '../logging/logger.js';
import { runInBatches } from '../maintenance/run-in-batches.js';
import { syncEntrySnapshots } from '../movies/entry-snapshots.js';
import { isAwardsStale, isExtraStale } from '../movies/freshness.js';
import { mergeMovie } from '../movies/merge-movie.js';
import { saveMovie } from '../movies/movie-repository.js';
import { toMovieSnapshot } from '../movies/movie-snapshot.js';
import type { EnrichContext, EnrichCount, PhaseProgress } from '../types/enrich.js';
import type { Movie } from '../types/movie.js';
import type { AwardsById, OmdbRatings, TmdbMovie } from '../types/sources.js';
import { mergeAwards } from './merge-awards.js';
import { processInOrder } from './process-in-order.js';

/** Quantos filmes buscar no TMDb e na OMDb ao mesmo tempo. */
const CONCURRENCY = 4;

/** O que um filme precisa nesta execução. */
type MovieNeeds = { extras: boolean; omdb: boolean; awards: boolean };

/** O que as fontes trouxeram para um filme (ausente quando não foi pedido ou falhou). */
type FetchedMovie = { tmdb?: TmdbMovie | undefined; omdb?: OmdbRatings | undefined; failed: boolean };

/** Prêmios de um lote, das duas fontes; null quando alguma falhou (os prêmios guardados ficam). */
type BatchAwards = { wikidata: AwardsById; wikipedia: AwardsById } | null;

/**
 * Diz o que um filme precisa: campos extras vencidos pedem TMDb e OMDb; prêmios vencidos pedem
 * Wikidata e Wikipedia (e a OMDb, para o resumo, se os prêmios nunca foram gravados).
 *
 * @param movie - Documento guardado, se existir.
 * @param now - Momento da execução.
 * @returns O que buscar.
 */
function needsOf(movie: Movie | undefined, now: Date): MovieNeeds {
  const extras = !movie || isExtraStale(movie, now);
  const awards = !movie || isAwardsStale(movie, now);
  return { extras, awards, omdb: extras || (awards && !movie?.awards) };
}

/**
 * Diz se o filme precisa de alguma busca nesta execução.
 *
 * @param movie - Documento guardado, se existir.
 * @param now - Momento da execução.
 * @returns true se os campos extras ou os prêmios estiverem vencidos.
 */
function movieNeedsEnrich(movie: Movie | undefined, now: Date): boolean {
  const needs = needsOf(movie, now);
  return needs.extras || needs.awards;
}

/**
 * Etapa dos filmes: atualiza, em lotes, os campos extras (TMDb e OMDb) e os prêmios (uma consulta
 * ao Wikidata e uma à Wikipedia por lote) dos filmes das listas e da fila que estão vencidos (30
 * dias) ou nunca foram buscados. Para quando o tempo acaba ou a cota da OMDb da execução chega ao
 * fim. Uma fonte de prêmios que falha deixa os prêmios guardados como estão, e o filme volta na
 * próxima execução.
 *
 * @param context - Dependências, momento, limites, tempo, filmes guardados e cota da OMDb.
 * @param tmdbIds - Filmes das listas e da fila, em ordem crescente.
 * @param after - Último filme tratado numa execução anterior do mesmo dia, ou null.
 * @param count - Contadores a atualizar.
 * @returns Até onde a etapa chegou.
 */
async function enrichMovies(
  context: EnrichContext,
  tmdbIds: number[],
  after: number | null,
  count: EnrichCount,
): Promise<PhaseProgress> {
  const stale = tmdbIds.filter((tmdbId) => movieNeedsEnrich(context.movies.get(tmdbId), context.now));
  return processInOrder(stale, after, context.limits.batchSize, context.budget, async (batch) => {
    const handled = withinOmdbQuota(context, batch);
    if (handled.length > 0) await enrichBatch(context, handled, count);
    return handled.length;
  });
}

/**
 * Corta o lote no ponto em que a cota da OMDb da execução acabaria, e desconta a cota.
 *
 * @param context - Filmes guardados, momento e cota que resta.
 * @param batch - Lote.
 * @returns O começo do lote que cabe na cota.
 */
function withinOmdbQuota(context: EnrichContext, batch: number[]): number[] {
  const handled: number[] = [];
  for (const tmdbId of batch) {
    const needs = needsOf(context.movies.get(tmdbId), context.now);
    if (needs.omdb) {
      if (context.omdbCallsLeft <= 0) break;
      context.omdbCallsLeft--;
    }
    handled.push(tmdbId);
  }
  return handled;
}

/**
 * Trata um lote de filmes: busca TMDb e OMDb de quem precisa, os prêmios do lote e grava cada filme.
 *
 * @param context - Dependências, momento e filmes guardados.
 * @param batch - Filmes do lote.
 * @param count - Contadores a atualizar.
 */
async function enrichBatch(context: EnrichContext, batch: number[], count: EnrichCount): Promise<void> {
  const fetched = new Map<number, FetchedMovie>();
  await runInBatches(batch, CONCURRENCY, async (tmdbId) => {
    fetched.set(tmdbId, await fetchMovieSources(context, tmdbId));
  });

  const awardIds = batch.filter((tmdbId) => {
    const stored = context.movies.get(tmdbId);
    return needsOf(stored, context.now).awards && (stored || fetched.get(tmdbId)?.tmdb);
  });
  const awards = awardIds.length > 0 ? await fetchBatchAwards(context, awardIds) : null;

  for (const tmdbId of batch) {
    const sources = fetched.get(tmdbId);
    const wantsAwards = awardIds.includes(tmdbId);
    try {
      const saved = await saveEnrichedMovie(context, tmdbId, sources, wantsAwards ? awards : undefined);
      // Conta como falho o filme em que alguma fonte necessária falhou, mesmo gravado em parte.
      if (saved && !sources?.failed && !(wantsAwards && !awards)) count.updated++;
      else count.failed++;
    } catch (error) {
      count.failed++;
      logger.warn('rotina enrich: filme não gravado', { tmdbId, error });
    }
  }
}

/**
 * Busca o TMDb (campos extras vencidos) e a OMDb (extras vencidos ou resumo de prêmios que falta)
 * de um filme. Falha de uma fonte fica no log e marca o filme como falho.
 *
 * @param context - Dependências, momento e filmes guardados.
 * @param tmdbId - Filme.
 * @returns O que veio de cada fonte.
 */
async function fetchMovieSources(context: EnrichContext, tmdbId: number): Promise<FetchedMovie> {
  const { sources } = context.dependencies;
  const stored = context.movies.get(tmdbId);
  const needs = needsOf(stored, context.now);
  const result: FetchedMovie = { failed: false };

  if (needs.extras) {
    try {
      result.tmdb = await context.usage.track('tmdb', () => sources.tmdb.getMovie(tmdbId));
    } catch (error) {
      logger.warn('rotina enrich: TMDb falhou', { tmdbId, error });
      return { failed: true };
    }
  }

  const imdbId = result.tmdb?.imdbId ?? stored?.ids.imdb ?? null;
  if (needs.omdb && imdbId) {
    try {
      result.omdb = await context.usage.track('omdb', () => sources.omdb.getRatings(imdbId));
    } catch (error) {
      logger.warn('rotina enrich: OMDb falhou', { tmdbId, error });
      result.failed = true;
    }
  }
  return result;
}

/**
 * Busca os prêmios de um lote: uma consulta ao Wikidata (que também dá o artigo de cada filme na
 * Wikipedia em inglês) e um pedido à Wikipedia pelas categorias desses artigos.
 *
 * @param context - Clientes das fontes e medidor de consumo.
 * @param tmdbIds - Filmes do lote que precisam de prêmios.
 * @returns Prêmios das duas fontes, ou null se alguma falhou.
 */
async function fetchBatchAwards(context: EnrichContext, tmdbIds: number[]): Promise<BatchAwards> {
  const { sources } = context.dependencies;
  try {
    const wikidata = await context.usage.track('wikidata', () => sources.wikidata.awardsByTmdbIds(tmdbIds));
    const articles = [...wikidata.enwikiTitles]
      .filter(([tmdbId]) => tmdbIds.includes(tmdbId))
      .map(([tmdbId, title]) => ({ tmdbId, title }));
    const wikipedia =
      articles.length > 0
        ? await context.usage.track('wikipedia', () => sources.wikipedia.awardsByArticles(articles))
        : new Map();
    return { wikidata: wikidata.awards, wikipedia };
  } catch (error) {
    logger.warn('rotina enrich: prêmios do lote não buscados', { tmdbIds, error });
    return null;
  }
}

/**
 * Monta e grava o filme com o que veio: catálogo e campos extras do TMDb (com `extraFetchedAt`),
 * notas, resumo e bilheteria da OMDb e os prêmios juntos das duas fontes. Quando o TMDb veio,
 * também corrige a cópia resumida nas entradas.
 *
 * @param context - Banco, momento e filmes guardados (o mapa recebe o filme gravado).
 * @param tmdbId - Filme.
 * @param fetched - O que TMDb e OMDb trouxeram.
 * @param awards - Prêmios do lote; undefined quando o filme não precisava, null quando falharam.
 * @returns true se o filme foi gravado.
 */
async function saveEnrichedMovie(
  context: EnrichContext,
  tmdbId: number,
  fetched: FetchedMovie | undefined,
  awards: BatchAwards | undefined,
): Promise<boolean> {
  const stored = context.movies.get(tmdbId);
  if (!stored && !fetched?.tmdb) return false;

  let movie = mergeMovie(stored, { tmdb: fetched?.tmdb, omdb: fetched?.omdb }, context.now);
  if (fetched?.tmdb) movie = { ...movie, extraFetchedAt: context.now };
  if (awards) {
    movie = {
      ...movie,
      awards: {
        items: mergeAwards(awards.wikidata.get(tmdbId) ?? [], awards.wikipedia.get(tmdbId) ?? []),
        summary: fetched?.omdb?.awardsSummary ?? movie.awards?.summary ?? null,
        fetchedAt: context.now,
      },
    };
  }
  if (stored && !fetched?.tmdb && !fetched?.omdb && !awards) return false;

  await saveMovie(context.dependencies.db, tmdbId, movie);
  context.movies.set(tmdbId, movie);
  if (fetched?.tmdb) await syncEntrySnapshots(context.dependencies.db, tmdbId, toMovieSnapshot(movie));
  return true;
}

export { enrichMovies, movieNeedsEnrich };

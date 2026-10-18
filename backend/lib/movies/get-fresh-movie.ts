import { isBechdelStale } from '../bechdel/bechdel-freshness.js';
import { createBechdelIndexLoader } from '../bechdel/bechdel-index-loader.js';
import { refreshBechdel } from '../bechdel/refresh-bechdel.js';
import { logger } from '../logging/logger.js';
import type { Dependencies } from '../types/dependencies.js';
import type { Bechdel, FetchedSources, Movie } from '../types/movie.js';
import type { UsageRecorder } from '../types/usage.js';
import { syncEntrySnapshots } from './entry-snapshots.js';
import { fetchStaleSources } from './fetch-stale-sources.js';
import { isExtraStale } from './freshness.js';
import { mergeMovie } from './merge-movie.js';
import { findMovie, saveMovie } from './movie-repository.js';
import { toMovieSnapshot } from './movie-snapshot.js';

/**
 * Devolve movies/{tmdbId} com cada fonte buscada há menos de 7 dias, buscando só o que venceu (o
 * TMDb traz catálogo, diretores e elenco com foto), e garante que a cópia resumida nas entradas das listas está igual ao filme.
 * Fora de `ratingsOnly`, também busca o Teste de Bechdel quando falta ou venceu (30 dias casado,
 * 7 dias não encontrado), depois das outras fontes, porque o casamento precisa do id do IMDb, e os
 * campos extras (curiosidades, onde assistir, resumo de prêmios e bilheteria) quando faltam ou têm
 * 30 dias ou mais: TMDb e OMDb são buscados mesmo frescos e `extraFetchedAt` recebe a data. Os
 * prêmios do Wikidata e da Wikipedia ficam com a rotina enrich.
 *
 * @param tmdbId - Id do filme no TMDb.
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo do pedido.
 * @param options - `ratingsOnly`: busca só as notas vencidas, sem o TMDb nem o Teste de Bechdel (rotina diária).
 * @returns O documento do filme.
 * @throws {NotFoundError} Se o filme ainda não estiver guardado e o TMDb não o tiver.
 * @throws {SourceUnavailableError} Se o filme ainda não estiver guardado e o TMDb falhar.
 */
export async function getFreshMovie(
  tmdbId: number,
  dependencies: Dependencies,
  usage: UsageRecorder,
  { ratingsOnly = false } = {},
): Promise<Movie> {
  const { db, sources, now } = dependencies;
  const stored = await findMovie(db, tmdbId);
  const fetchedAt = now();
  const forceExtras = !ratingsOnly && (!stored || isExtraStale(stored, fetchedAt));
  const fetched = await fetchStaleSources({ tmdbId, stored, now: fetchedAt, sources, usage, ratingsOnly, forceExtras });

  let movie = stored && !fetchedAnySource(fetched) ? stored : mergeMovie(stored, fetched, fetchedAt);
  // Os campos extras contam como buscados quando o TMDb respondeu (a OMDb só completa o resumo).
  if (forceExtras && fetched.tmdb) movie = { ...movie, extraFetchedAt: fetchedAt };
  if (!ratingsOnly) {
    const bechdel = await fetchBechdelIfStale(tmdbId, movie, dependencies, usage, fetchedAt);
    if (bechdel) movie = { ...movie, bechdel };
  }
  if (movie !== stored) await saveMovie(db, tmdbId, movie);

  // Roda mesmo sem mudança no filme: uma entrada recém-gravada pelo app pode ter uma cópia
  // diferente. Só as entradas desatualizadas são regravadas.
  await syncEntrySnapshots(db, tmdbId, toMovieSnapshot(movie));
  return movie;
}

/**
 * Busca o Teste de Bechdel se ele faltar ou tiver vencido. Fresco conta como acerto de cache; falha
 * do site vai para o log (e para `usage/{dia}.bechdel.errors`), e o valor guardado continua valendo.
 *
 * @param tmdbId - Id do filme, para o log.
 * @param movie - Documento já atualizado pelas outras fontes.
 * @param dependencies - Clientes das fontes.
 * @param usage - Medidor de consumo do pedido.
 * @param now - Momento da busca.
 * @returns O valor novo, ou undefined se estava fresco ou o site falhou.
 */
async function fetchBechdelIfStale(
  tmdbId: number,
  movie: Movie,
  { sources }: Dependencies,
  usage: UsageRecorder,
  now: Date,
): Promise<Bechdel | undefined> {
  if (!isBechdelStale(movie, now)) {
    usage.count('bechdel', 'cacheHits');
    return undefined;
  }

  try {
    const loadIndex = createBechdelIndexLoader(sources.bechdel, usage);
    const { bechdel } = await refreshBechdel(movie, { client: sources.bechdel, usage, now, loadIndex });
    return bechdel;
  } catch (error) {
    logger.warn('Teste de Bechdel falhou; mantendo o valor guardado', { tmdbId, error });
    return undefined;
  }
}

/**
 * Diz se alguma fonte trouxe dados neste pedido.
 *
 * @param fetched - O que cada fonte trouxe.
 * @returns true se ao menos uma fonte trouxe algo.
 */
function fetchedAnySource(fetched: FetchedSources): boolean {
  return Boolean(fetched.tmdb || fetched.letterboxd || fetched.omdb);
}

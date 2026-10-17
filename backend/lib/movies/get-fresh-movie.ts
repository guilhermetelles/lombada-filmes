import type { Dependencies } from '../types/dependencies.js';
import type { FetchedSources, Movie } from '../types/movie.js';
import type { UsageRecorder } from '../types/usage.js';
import { syncEntrySnapshots } from './entry-snapshots.js';
import { fetchStaleSources } from './fetch-stale-sources.js';
import { mergeMovie } from './merge-movie.js';
import { findMovie, saveMovie } from './movie-repository.js';
import { toMovieSnapshot } from './movie-snapshot.js';

/**
 * Devolve movies/{tmdbId} com as notas buscadas há menos de 7 dias, buscando só o que venceu (o
 * TMDb só na primeira vez), e garante que a cópia resumida nas entradas das listas está igual ao filme.
 *
 * @param tmdbId - Id do filme no TMDb.
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo do pedido.
 * @returns O documento do filme.
 * @throws {NotFoundError} Se o filme ainda não estiver guardado e o TMDb não o tiver.
 * @throws {SourceUnavailableError} Se o filme ainda não estiver guardado e o TMDb falhar.
 */
export async function getFreshMovie(
  tmdbId: number,
  { db, sources, now }: Dependencies,
  usage: UsageRecorder,
): Promise<Movie> {
  const stored = await findMovie(db, tmdbId);
  const fetchedAt = now();
  const fetched = await fetchStaleSources({ tmdbId, stored, now: fetchedAt, sources, usage });

  const movie = stored && !fetchedAnySource(fetched) ? stored : mergeMovie(stored, fetched, fetchedAt);
  if (movie !== stored) await saveMovie(db, tmdbId, movie);

  // Roda mesmo sem mudança no filme: uma entrada recém-gravada pelo app pode ter uma cópia
  // diferente. Só as entradas desatualizadas são regravadas.
  await syncEntrySnapshots(db, tmdbId, toMovieSnapshot(movie));
  return movie;
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

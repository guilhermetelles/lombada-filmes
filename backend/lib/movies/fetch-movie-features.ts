import { logger } from '../logging/logger.js';
import type { Dependencies } from '../types/dependencies.js';
import type { Movie } from '../types/movie.js';
import type { TmdbMovie } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import { isStale } from './freshness.js';
import { mergeMovie } from './merge-movie.js';
import { findMovie, saveMovie } from './movie-repository.js';

/**
 * Garante movies/{tmdbId} com o catálogo e os campos extras do TMDb (gêneros, diretores, elenco,
 * palavras-chave, recomendações, saga, popularidade, nota, onde assistir), indo só ao TMDb: sem
 * OMDb, Letterboxd nem Teste de Bechdel. É o que os candidatos das sugestões e a fila "Quero ver"
 * usam, para não gastar a cota da OMDb com filmes que talvez ninguém abra.
 *
 * Um filme novo fica sem notas (`ratings` vazio) e sem `extraFetchedAt`: as notas chegam quando
 * alguém abre o filme, e a rotina enrich completa os filmes da fila (OMDb e prêmios). Com o TMDb
 * guardado há menos de 7 dias e os campos extras presentes, devolve o guardado sem pedido. A cópia
 * resumida nas entradas das listas não é conferida aqui (é papel de getFreshMovie).
 *
 * @param tmdbId - Id do filme no TMDb.
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo do pedido.
 * @returns O documento do filme.
 * @throws {NotFoundError} Se o filme ainda não estiver guardado e o TMDb não o tiver.
 * @throws {SourceUnavailableError} Se o filme ainda não estiver guardado e o TMDb falhar.
 */
async function fetchMovieFeatures(
  tmdbId: number,
  { db, sources, now }: Dependencies,
  usage: UsageRecorder,
): Promise<Movie> {
  const stored = await findMovie(db, tmdbId);
  const fetchedAt = now();
  if (stored && stored.keywords !== undefined && !isStale(stored, 'tmdb', fetchedAt)) {
    usage.count('tmdb', 'cacheHits');
    return stored;
  }

  let tmdb: TmdbMovie;
  try {
    tmdb = await usage.track('tmdb', () => sources.tmdb.getMovie(tmdbId));
  } catch (error) {
    if (!stored) throw error;
    logger.warn('TMDb falhou; mantendo o filme guardado', { tmdbId, error });
    return stored;
  }

  const movie = mergeMovie(stored, { tmdb }, fetchedAt);
  await saveMovie(db, tmdbId, movie);
  return movie;
}

export { fetchMovieFeatures };

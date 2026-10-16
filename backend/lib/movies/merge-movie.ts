import type { FetchedSources, Movie } from '../types/movie.js';
import type { LetterboxdRating, OmdbRatings, TmdbMovie } from '../types/sources.js';

/**
 * Junta o documento guardado com o que as fontes trouxeram agora. O que não veio continua como
 * estava, com a data em que foi buscado.
 *
 * @param stored - Documento guardado, se existir.
 * @param fetched - O que cada fonte trouxe neste pedido.
 * @param now - Data a gravar nas fontes que vieram.
 * @returns O documento atualizado (sem alterar o guardado).
 * @throws {Error} Se não houver documento guardado nem dados do TMDb, que dão título, ano e o id do IMDb.
 */
export function mergeMovie(stored: Movie | undefined, fetched: FetchedSources, now: Date): Movie {
  let movie = fetched.tmdb ? applyTmdb(stored, fetched.tmdb, now) : stored;
  if (!movie) throw new Error('mergeMovie: sem documento guardado, o TMDb é obrigatório');

  if (fetched.letterboxd) movie = applyLetterboxd(movie, fetched.letterboxd, now);
  if (fetched.omdb) movie = applyOmdb(movie, fetched.omdb, now);
  return movie;
}

/**
 * Troca o catálogo inteiro pelo do TMDb e mantém as notas e o endereço do Letterboxd guardados.
 *
 * @param stored - Documento guardado, se existir.
 * @param tmdb - Filme vindo do TMDb.
 * @param now - Data da busca.
 * @returns O documento com o catálogo novo.
 */
function applyTmdb(stored: Movie | undefined, tmdb: TmdbMovie, now: Date): Movie {
  return {
    title: tmdb.title,
    year: tmdb.year,
    directors: tmdb.directors,
    runtime: tmdb.runtime,
    genres: tmdb.genres,
    synopsis: tmdb.synopsis,
    posterPath: tmdb.posterPath,
    ids: { imdb: tmdb.imdbId, letterboxd: stored?.ids.letterboxd ?? null },
    ratings: stored?.ratings ?? {},
    tmdbFetchedAt: now,
  };
}

/**
 * Grava a nota do Letterboxd. O endereço da página só muda quando o Letterboxd devolve um.
 *
 * @param movie - Documento a atualizar.
 * @param letterboxd - Nota vinda do Letterboxd.
 * @param now - Data da busca.
 * @returns O documento com a nota nova.
 */
function applyLetterboxd(movie: Movie, letterboxd: LetterboxdRating, now: Date): Movie {
  return {
    ...movie,
    ids: { ...movie.ids, letterboxd: letterboxd.url ?? movie.ids.letterboxd },
    ratings: {
      ...movie.ratings,
      letterboxd: { value: letterboxd.value, count: letterboxd.count, fetchedAt: now },
    },
  };
}

/**
 * Grava as três notas que a OMDb traz juntas (IMDb, Rotten Tomatoes e Metacritic).
 *
 * @param movie - Documento a atualizar.
 * @param omdb - Notas vindas da OMDb.
 * @param now - Data da busca.
 * @returns O documento com as notas novas.
 */
function applyOmdb(movie: Movie, omdb: OmdbRatings, now: Date): Movie {
  return {
    ...movie,
    ratings: {
      ...movie.ratings,
      imdb: { ...omdb.imdb, fetchedAt: now },
      rottenTomatoes: { ...omdb.rottenTomatoes, fetchedAt: now },
      metacritic: { ...omdb.metacritic, fetchedAt: now },
    },
  };
}

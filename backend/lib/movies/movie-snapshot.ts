import { MovieSnapshotSchema } from '../schemas/movie.js';
import type { Movie, MovieSnapshot } from '../types/movie.js';

/**
 * Monta a cópia resumida do filme que vai nas entradas das listas.
 *
 * @param movie - Documento do filme.
 * @returns Título, ano, capa e as notas do IMDb e do Letterboxd.
 */
export function toMovieSnapshot(movie: Movie): MovieSnapshot {
  return {
    title: movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
    imdb: movie.ratings.imdb?.value ?? null,
    letterboxd: movie.ratings.letterboxd?.value ?? null,
  };
}

/**
 * Compara a cópia atual com a que está gravada numa entrada. O valor gravado vem do banco sem tipo
 * garantido; o que não tiver o formato da cópia conta como diferente.
 *
 * @param snapshot - Cópia atual.
 * @param stored - Valor gravado em entries/{id}.movie.
 * @returns true se todos os campos forem iguais.
 */
export function isSameSnapshot(snapshot: MovieSnapshot, stored: unknown): boolean {
  const parsed = MovieSnapshotSchema.safeParse(stored);
  if (!parsed.success) return false;
  return (Object.keys(snapshot) as (keyof MovieSnapshot)[]).every((field) => snapshot[field] === parsed.data[field]);
}

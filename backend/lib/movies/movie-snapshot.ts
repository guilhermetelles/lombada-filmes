import { MovieSnapshotSchema } from '../schemas/movie.js';
import type { Movie, MovieSnapshot } from '../types/movie.js';
import type { PersonRef } from '../types/person.js';

/**
 * Quantos diretores vão na cópia resumida. As regras do Firestore não conseguem validar mais que
 * isso numa entrada (passa do limite de expressões); o filme completo continua em movies/{tmdbId}.
 */
const SNAPSHOT_DIRECTORS_LIMIT = 8;

/**
 * Monta a cópia resumida do filme que vai nas entradas das listas.
 *
 * @param movie - Documento do filme.
 * @returns Título, ano, capa, as notas do IMDb e do Letterboxd e os primeiros 8 diretores.
 */
export function toMovieSnapshot(movie: Movie): MovieSnapshot {
  return {
    title: movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
    imdb: movie.ratings.imdb?.value ?? null,
    letterboxd: movie.ratings.letterboxd?.value ?? null,
    directors: movie.directors.slice(0, SNAPSHOT_DIRECTORS_LIMIT),
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
  const other = parsed.data;
  return (
    snapshot.title === other.title &&
    snapshot.year === other.year &&
    snapshot.posterPath === other.posterPath &&
    snapshot.imdb === other.imdb &&
    snapshot.letterboxd === other.letterboxd &&
    isSamePeople(snapshot.directors, other.directors)
  );
}

/**
 * Compara duas listas de pessoas na mesma ordem.
 *
 * @param a - Primeira lista.
 * @param b - Segunda lista.
 * @returns true se tiverem as mesmas pessoas (id e nome) na mesma ordem.
 */
function isSamePeople(a: PersonRef[], b: PersonRef[]): boolean {
  return (
    a.length === b.length && a.every((person, index) => person.id === b[index]?.id && person.name === b[index]?.name)
  );
}

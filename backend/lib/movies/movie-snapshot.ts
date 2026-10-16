import { MovieSnapshotSchema } from '../schemas/movie.js';
import type { Movie, MovieSnapshot } from '../types/movie.js';
import type { PersonRef } from '../types/person.js';

/**
 * Limites que firestore.rules exige da cópia resumida (isValidMovieSnapshot). O app revalida a
 * entrada inteira a cada edição, então uma cópia fora deles travaria as edições daquela entrada.
 * Diretores: com mais de 8, a validação passa do limite de expressões das regras.
 */
const SNAPSHOT_LIMITS = {
  titleLength: 300,
  posterPathLength: 200,
  years: { min: 1870, max: 2100 },
  imdb: { min: 0, max: 10 },
  letterboxd: { min: 0, max: 5 },
  directors: 8,
  directorNameLength: 200,
};

/**
 * Monta a cópia resumida do filme que vai nas entradas das listas, já dentro dos limites das
 * regras: o que não cabe é cortado ou fica null; o filme completo continua em movies/{tmdbId}.
 *
 * @param movie - Documento do filme.
 * @returns Título, ano, capa, as notas do IMDb e do Letterboxd e os primeiros 8 diretores.
 */
export function toMovieSnapshot(movie: Movie): MovieSnapshot {
  return {
    title: movie.title.slice(0, SNAPSHOT_LIMITS.titleLength),
    year: withinRange(movie.year, SNAPSHOT_LIMITS.years),
    posterPath:
      movie.posterPath && movie.posterPath.length <= SNAPSHOT_LIMITS.posterPathLength ? movie.posterPath : null,
    imdb: withinRange(movie.ratings.imdb?.value ?? null, SNAPSHOT_LIMITS.imdb),
    letterboxd: withinRange(movie.ratings.letterboxd?.value ?? null, SNAPSHOT_LIMITS.letterboxd),
    directors: movie.directors
      .filter((director) => director.id > 0 && director.name.trim().length > 0)
      .slice(0, SNAPSHOT_LIMITS.directors)
      .map(({ id, name }) => ({ id, name: name.slice(0, SNAPSHOT_LIMITS.directorNameLength) })),
  };
}

/**
 * Mantém um número só se estiver dentro do intervalo.
 *
 * @param value - Número, ou null.
 * @param range - Mínimo e máximo aceitos, inclusive.
 * @returns O número, ou null se faltar ou estiver fora do intervalo.
 */
function withinRange(value: number | null, { min, max }: { min: number; max: number }): number | null {
  return value !== null && value >= min && value <= max ? value : null;
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
    isSamePersonList(snapshot.directors, other.directors)
  );
}

/**
 * Compara duas listas de pessoas na mesma ordem.
 *
 * @param a - Primeira lista.
 * @param b - Segunda lista.
 * @returns true se tiverem as mesmas pessoas (id e nome) na mesma ordem.
 */
function isSamePersonList(a: PersonRef[], b: PersonRef[]): boolean {
  return (
    a.length === b.length && a.every((person, index) => person.id === b[index]?.id && person.name === b[index]?.name)
  );
}

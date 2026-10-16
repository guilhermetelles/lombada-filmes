import type { Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
import { MovieSchema } from '../schemas/movie.js';
import type { Movie } from '../types/movie.js';

/** Valida ao ler: um documento fora do formato falha aqui, e não longe dali. */
const movieConverter: FirestoreDataConverter<Movie> = {
  toFirestore: (movie) => movie,
  fromFirestore: (snapshot) => MovieSchema.parse(snapshot.data()),
};

/**
 * Referência a movies/{tmdbId}, com validação na leitura.
 *
 * @param db - Firestore.
 * @param tmdbId - Id do filme no TMDb.
 * @returns A referência tipada.
 */
const movieDocument = (db: Firestore, tmdbId: number) => db.doc(`movies/${tmdbId}`).withConverter(movieConverter);

/**
 * Lê movies/{tmdbId}, validando o formato.
 *
 * @param db - Firestore.
 * @param tmdbId - Id do filme no TMDb.
 * @returns O documento, ou undefined se ainda não existir.
 * @throws {ZodError} Se o documento gravado estiver fora do formato.
 */
export async function findMovie(db: Firestore, tmdbId: number): Promise<Movie | undefined> {
  const snapshot = await movieDocument(db, tmdbId).get();
  return snapshot.data();
}

/**
 * Grava movies/{tmdbId} por inteiro.
 *
 * @param db - Firestore.
 * @param tmdbId - Id do filme no TMDb.
 * @param movie - Documento completo.
 */
export async function saveMovie(db: Firestore, tmdbId: number, movie: Movie): Promise<void> {
  await movieDocument(db, tmdbId).set(movie);
}

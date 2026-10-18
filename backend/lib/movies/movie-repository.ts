import type { Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
import { writeInBatches } from '../firestore/write-in-batches.js';
import { logger } from '../logging/logger.js';
import { MovieSchema } from '../schemas/movie.js';
import type { Bechdel, Movie } from '../types/movie.js';

/** Um filme guardado e o id dele no TMDb. */
export type StoredMovie = { tmdbId: number; movie: Movie };

/** Critérios e duvidosa de um filme casado, como o índice do bechdeltest.com traz. */
export type BechdelRatingUpdate = { tmdbId: number; rating: number; dubious: boolean };

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
 * Lê vários movies/{tmdbId} numa ida só ao banco. Um documento fora do formato conta como ausente
 * (registrado no log), para não derrubar a rotina que pediu.
 *
 * @param db - Firestore.
 * @param tmdbIds - Ids dos filmes no TMDb.
 * @returns Os documentos encontrados, por id; quem não existe fica fora do mapa.
 */
export async function findMovies(db: Firestore, tmdbIds: number[]): Promise<Map<number, Movie>> {
  const movies = new Map<number, Movie>();
  if (tmdbIds.length === 0) return movies;
  const snapshots = await db.getAll(...tmdbIds.map((tmdbId) => db.doc(`movies/${tmdbId}`)));
  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    const parsed = MovieSchema.safeParse(snapshot.data());
    if (parsed.success) movies.set(Number(snapshot.id), parsed.data);
    else logger.warn('filme fora do formato, pulado', { tmdbId: snapshot.id });
  }
  return movies;
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

/**
 * Lê todos os filmes guardados, para a rotina diária. Um documento fora do formato não pode
 * derrubar a rotina inteira: fica de fora, registrado no log.
 *
 * @param db - Firestore.
 * @returns Os filmes válidos, com o id do TMDb.
 */
export async function listMovies(db: Firestore): Promise<StoredMovie[]> {
  const snapshot = await db.collection('movies').get();
  return snapshot.docs.flatMap((doc) => {
    const tmdbId = Number(doc.id);
    const parsed = MovieSchema.safeParse(doc.data());
    if (parsed.success) return [{ tmdbId, movie: parsed.data }];
    logger.warn('filme fora do formato, pulado', { tmdbId });
    return [];
  });
}

/**
 * Grava só o Teste de Bechdel de um filme, sem tocar no resto do documento.
 *
 * @param db - Firestore.
 * @param tmdbId - Id do filme no TMDb.
 * @param bechdel - Valor novo.
 */
export async function saveBechdel(db: Firestore, tmdbId: number, bechdel: Bechdel): Promise<void> {
  await db.doc(`movies/${tmdbId}`).update({ bechdel });
}

/**
 * Atualiza critérios e duvidosa de vários filmes casados, em lotes. A data da página
 * (`bechdel.fetchedAt`) e as contestações ficam como estão, porque vêm da página, não do índice.
 *
 * @param db - Firestore.
 * @param updates - Filmes e os valores novos.
 */
export async function updateBechdelRatings(db: Firestore, updates: BechdelRatingUpdate[]): Promise<void> {
  await writeInBatches(db, updates, (batch, { tmdbId, rating, dubious }) =>
    batch.update(db.doc(`movies/${tmdbId}`), { 'bechdel.rating': rating, 'bechdel.dubious': dubious }),
  );
}

import type { DocumentReference, Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
import { QueueItemSchema } from '../schemas/queue.js';
import type { QueueItem } from '../types/queue.js';

/** Valida ao ler. */
const queueConverter: FirestoreDataConverter<QueueItem> = {
  toFirestore: (item) => item,
  fromFirestore: (snapshot) => QueueItemSchema.parse(snapshot.data()),
};

/**
 * Referência a lists/{listId}/queue/{tmdbId}: um filme na fila "Quero ver".
 *
 * @param db - Firestore.
 * @param listId - Lista da fila.
 * @param tmdbId - Id do filme no TMDb (também é o id do documento).
 * @returns A referência tipada.
 */
function queueDocument(db: Firestore, listId: string, tmdbId: number): DocumentReference<QueueItem> {
  return db.collection('lists').doc(listId).collection('queue').doc(String(tmdbId)).withConverter(queueConverter);
}

export { queueDocument };

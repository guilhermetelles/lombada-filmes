import type { Firestore } from 'firebase-admin/firestore';
import { requireMember } from '../lists/list-access.js';
import { listDocument } from '../lists/list-repository.js';
import { queueDocument } from './queue-repository.js';

/**
 * Tira um filme da fila "Quero ver" da lista. Sem erro se ele não estava na fila.
 *
 * @param db - Firestore.
 * @param uid - Quem pede.
 * @param listId - Lista da fila.
 * @param tmdbId - Id do filme no TMDb.
 * @throws {NotFoundError} Se a lista não existir.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 */
async function removeFromQueue(db: Firestore, uid: string, listId: string, tmdbId: number): Promise<void> {
  requireMember((await listDocument(db, listId).get()).data(), uid);
  await queueDocument(db, listId, tmdbId).delete();
}

export { removeFromQueue };

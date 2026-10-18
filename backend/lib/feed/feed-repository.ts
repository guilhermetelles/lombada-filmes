import type { CollectionReference, Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
import { withoutUndefined } from '../firestore/without-undefined.js';
import { FeedItemSchema } from '../schemas/feed.js';
import type { FeedItem } from '../types/feed.js';

/** Valida ao ler; ao gravar, tira os campos opcionais ausentes (o Firestore recusa undefined). */
const feedConverter: FirestoreDataConverter<FeedItem> = {
  toFirestore: (item) => withoutUndefined(item),
  fromFirestore: (snapshot) => FeedItemSchema.parse(snapshot.data()),
};

/**
 * Coleção lists/{listId}/feed, com validação na leitura.
 *
 * @param db - Firestore.
 * @param listId - Lista da Atividade.
 * @returns A coleção tipada.
 */
function feedCollection(db: Firestore, listId: string): CollectionReference<FeedItem> {
  return db.collection('lists').doc(listId).collection('feed').withConverter(feedConverter);
}

export { feedCollection };

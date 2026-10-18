import type { DocumentReference, Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
import { RetroSchema } from '../schemas/retro.js';
import type { Retro } from '../types/retro.js';

/** Valida ao ler. */
const retroConverter: FirestoreDataConverter<Retro> = {
  toFirestore: (retro) => retro,
  fromFirestore: (snapshot) => RetroSchema.parse(snapshot.data()),
};

/**
 * Referência a lists/{listId}/retros/{mês}, com validação na leitura.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param month - Mês (AAAA-MM).
 * @returns A referência tipada.
 */
function retroDocument(db: Firestore, listId: string, month: string): DocumentReference<Retro> {
  return db.doc(`lists/${listId}/retros/${month}`).withConverter(retroConverter);
}

export { retroDocument };

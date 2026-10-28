import type { DocumentReference, Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
import { withoutUndefined } from '../firestore/without-undefined.js';
import { DuelSchema } from '../schemas/duel.js';
import type { Duel, DuelView } from '../types/duel.js';

/** Conversor de duels/{dia}: valida ao ler e tira os campos opcionais ausentes ao gravar. */
const duelConverter: FirestoreDataConverter<Duel> = {
  toFirestore: (value) => withoutUndefined(value),
  fromFirestore: (snapshot) => DuelSchema.parse(snapshot.data()),
};

/**
 * Referência a lists/{listId}/duels/{dia}: o par do dia e os votos.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param day - Dia como AAAA-MM-DD.
 * @returns A referência tipada.
 */
export function duelDocument(db: Firestore, listId: string, day: string): DocumentReference<Duel> {
  return db.doc(`lists/${listId}/duels/${day}`).withConverter(duelConverter);
}

/**
 * Tira do documento o que o app recebe.
 *
 * @param duel - Documento do duelo.
 * @returns Dia, par, situação e votos.
 */
export function toDuelView({ day, entryIdA, entryIdB, status, votes }: Duel): DuelView {
  return { day, entryIdA, entryIdB, status, votes };
}

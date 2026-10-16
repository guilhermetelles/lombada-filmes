import type { DocumentReference, Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
import { InviteSchema, ListSchema } from '../schemas/list.js';
import type { Invite, List } from '../types/list.js';

/** Valida ao ler; ao gravar, tira o `source` ausente (o Firestore recusa campos undefined). */
const listConverter: FirestoreDataConverter<List> = {
  toFirestore: ({ source, ...list }) => (source ? { ...list, source } : list),
  fromFirestore: (snapshot) => ListSchema.parse(snapshot.data()),
};

/** Valida ao ler. */
const inviteConverter: FirestoreDataConverter<Invite> = {
  toFirestore: (invite) => invite,
  fromFirestore: (snapshot) => InviteSchema.parse(snapshot.data()),
};

/**
 * Referência a lists/{listId}, com validação na leitura.
 *
 * @param db - Firestore.
 * @param listId - Id da lista.
 * @returns A referência tipada.
 */
export function listDocument(db: Firestore, listId: string): DocumentReference<List> {
  return db.collection('lists').doc(listId).withConverter(listConverter);
}

/**
 * Referência a uma lista nova, com id gerado pelo Firestore.
 *
 * @param db - Firestore.
 * @returns A referência tipada, ainda sem documento.
 */
export function newListDocument(db: Firestore): DocumentReference<List> {
  return db.collection('lists').doc().withConverter(listConverter);
}

/**
 * Referência a invites/{code}, com validação na leitura.
 *
 * @param db - Firestore.
 * @param code - Código de convite, já normalizado (6 caracteres, maiúsculas).
 * @returns A referência tipada.
 */
export function inviteDocument(db: Firestore, code: string): DocumentReference<Invite> {
  return db.collection('invites').doc(code).withConverter(inviteConverter);
}

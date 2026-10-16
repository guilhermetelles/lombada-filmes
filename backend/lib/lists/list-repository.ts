import type {
  CollectionReference,
  DocumentReference,
  Firestore,
  FirestoreDataConverter,
  Query,
} from 'firebase-admin/firestore';
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
  return invitesCollection(db).doc(code);
}

/**
 * Coleção invites/, com validação na leitura.
 *
 * @param db - Firestore.
 * @returns A coleção tipada.
 */
export function invitesCollection(db: Firestore): CollectionReference<Invite> {
  return db.collection('invites').withConverter(inviteConverter);
}

/**
 * Consulta os códigos de convite de uma lista.
 *
 * @param db - Firestore.
 * @param listId - Lista dos convites.
 * @returns A consulta tipada.
 */
export function invitesOfList(db: Firestore, listId: string): Query<Invite> {
  return invitesCollection(db).where('listId', '==', listId);
}

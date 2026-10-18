import {
  type CollectionReference,
  type DocumentReference,
  FieldPath,
  type Firestore,
  type FirestoreDataConverter,
  type Query,
} from 'firebase-admin/firestore';
import { withoutUndefined } from '../firestore/without-undefined.js';
import { InviteSchema, ListSchema } from '../schemas/list.js';
import type { Invite, List } from '../types/list.js';

/** Valida ao ler; ao gravar, tira `source` e `memberProfiles` ausentes (o Firestore recusa undefined). */
const listConverter: FirestoreDataConverter<List> = {
  toFirestore: (list) => withoutUndefined(list),
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
 * Coleção lists/, com validação na leitura (para o script de migração percorrer todas as listas).
 *
 * @param db - Firestore.
 * @returns A coleção tipada.
 */
export function listsCollection(db: Firestore): CollectionReference<List> {
  return db.collection('lists').withConverter(listConverter);
}

/**
 * Consulta as listas de que a pessoa é integrante.
 *
 * @param db - Firestore.
 * @param uid - Integrante.
 * @returns A consulta tipada.
 */
export function listsOfMember(db: Firestore, uid: string): Query<List> {
  return listsCollection(db).where('memberUids', 'array-contains', uid);
}

/**
 * Caminho do perfil de um membro dentro do documento da lista (memberProfiles.{uid}), para
 * gravar ou apagar só essa chave com update().
 *
 * @param uid - Membro.
 * @returns O caminho do campo.
 */
export function memberProfileField(uid: string): FieldPath {
  return new FieldPath('memberProfiles', uid);
}

/**
 * Consulta as entradas da lista que usam um filme (no máximo uma, na prática).
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param tmdbId - Id do filme no TMDb.
 * @returns A consulta, sem conversor (só para saber se existe).
 */
export function entriesOfMovie(db: Firestore, listId: string, tmdbId: number): Query {
  return db.collection('lists').doc(listId).collection('entries').where('tmdbId', '==', tmdbId);
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

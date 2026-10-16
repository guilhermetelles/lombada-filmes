import type { Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
import { PersonSchema } from '../schemas/person.js';
import type { Person } from '../types/person.js';

/** Valida ao ler: um documento fora do formato falha aqui, e não longe dali. */
const personConverter: FirestoreDataConverter<Person> = {
  toFirestore: (person) => person,
  fromFirestore: (snapshot) => PersonSchema.parse(snapshot.data()),
};

/**
 * Referência a people/{personId}, com validação na leitura.
 *
 * @param db - Firestore.
 * @param personId - Id de pessoa no TMDb.
 * @returns A referência tipada.
 */
const personDocument = (db: Firestore, personId: number) => db.doc(`people/${personId}`).withConverter(personConverter);

/**
 * Lê people/{personId}, validando o formato.
 *
 * @param db - Firestore.
 * @param personId - Id de pessoa no TMDb.
 * @returns O documento, ou undefined se ainda não existir.
 * @throws {ZodError} Se o documento gravado estiver fora do formato.
 */
export async function findPerson(db: Firestore, personId: number): Promise<Person | undefined> {
  return (await personDocument(db, personId).get()).data();
}

/**
 * Grava people/{personId} por inteiro.
 *
 * @param db - Firestore.
 * @param personId - Id de pessoa no TMDb.
 * @param person - Documento completo.
 */
export async function savePerson(db: Firestore, personId: number, person: Person): Promise<void> {
  await personDocument(db, personId).set(person);
}

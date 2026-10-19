import type { Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import { EnrichCursorSchema } from '../schemas/enrich.js';
import type { EnrichCursor } from '../types/enrich.js';

/** Valida ao ler. */
const cursorConverter: FirestoreDataConverter<EnrichCursor> = {
  toFirestore: (cursor) => cursor,
  fromFirestore: (snapshot) => EnrichCursorSchema.parse(snapshot.data()),
};

/**
 * Referência a jobs/enrich, com validação na leitura.
 *
 * @param db - Firestore.
 * @returns A referência tipada.
 */
const cursorDocument = (db: Firestore) => db.doc('jobs/enrich').withConverter(cursorConverter);

/**
 * Lê onde a rotina enrich parou. Um documento fora do formato não pode travar a rotina: conta como
 * ausente (a rotina recomeça), registrado no log.
 *
 * @param db - Firestore.
 * @returns O cursor, ou undefined se não houver (ou estiver fora do formato).
 */
async function readEnrichCursor(db: Firestore): Promise<EnrichCursor | undefined> {
  try {
    return (await cursorDocument(db).get()).data();
  } catch (error) {
    logger.warn('jobs/enrich fora do formato; recomeçando a rotina', { error });
    return undefined;
  }
}

/**
 * Grava onde a rotina enrich parou.
 *
 * @param db - Firestore.
 * @param cursor - Cursor novo.
 */
async function saveEnrichCursor(db: Firestore, cursor: EnrichCursor): Promise<void> {
  await cursorDocument(db).set(cursor, { merge: true });
}

export { readEnrichCursor, saveEnrichCursor };

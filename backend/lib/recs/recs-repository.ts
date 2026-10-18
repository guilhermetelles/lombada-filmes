import type { DocumentReference, Firestore, FirestoreDataConverter, Timestamp } from 'firebase-admin/firestore';
import { listDocument } from '../lists/list-repository.js';
import { logger } from '../logging/logger.js';
import { RecsDocSchema } from '../schemas/recs.js';
import type { RecsDoc } from '../types/recs.js';
import type { ListFilm } from './score-recs.js';

/** Valida ao ler. */
const recsConverter: FirestoreDataConverter<RecsDoc> = {
  toFirestore: (recs) => recs,
  fromFirestore: (snapshot) => RecsDocSchema.parse(snapshot.data()),
};

/**
 * Referência a lists/{listId}/recs/current, com validação na leitura.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @returns A referência tipada.
 */
export function recsDocument(db: Firestore, listId: string): DocumentReference<RecsDoc> {
  return listDocument(db, listId).collection('recs').doc('current').withConverter(recsConverter);
}

/**
 * Lê recs/current da lista. Um documento fora do formato conta como ausente (registrado no log).
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @returns O documento e a hora da última gravação, ou undefined.
 */
export async function readRecs(
  db: Firestore,
  listId: string,
): Promise<{ recs: RecsDoc; updateTime: Timestamp } | undefined> {
  const snapshot = await listDocument(db, listId).collection('recs').doc('current').get();
  if (!snapshot.exists || !snapshot.updateTime) return undefined;
  const parsed = RecsDocSchema.safeParse(snapshot.data());
  if (parsed.success) return { recs: parsed.data, updateTime: snapshot.updateTime };
  logger.warn('recs/current fora do formato, ignorado', { listId });
  return undefined;
}

/**
 * Lê os filmes da lista na ordem do ranking (rankKey crescente), com o comentário e a data em que
 * a dupla viu.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @returns Os filmes, com a posição (1 é o topo).
 */
export async function readListFilms(db: Firestore, listId: string): Promise<ListFilm[]> {
  const entries = await listDocument(db, listId)
    .collection('entries')
    .orderBy('rankKey')
    .select('tmdbId', 'comment', 'watchedOn')
    .get();
  const films: ListFilm[] = [];
  for (const entry of entries.docs) {
    const tmdbId = entry.get('tmdbId');
    if (typeof tmdbId !== 'number') continue;
    const comment = entry.get('comment');
    const watchedOn = entry.get('watchedOn');
    films.push({
      entryId: entry.id,
      tmdbId,
      position: films.length + 1,
      comment: typeof comment === 'string' ? comment : '',
      watchedOn: typeof watchedOn === 'string' ? watchedOn : null,
    });
  }
  return films;
}

/**
 * Lê os filmes que não podem ser sugeridos além dos da lista: os da fila "Quero ver" e os marcados
 * como "Não quero" (o id do documento é o id do TMDb nas duas coleções).
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @returns Os ids do TMDb.
 */
export async function readExcludedMovieIds(db: Firestore, listId: string): Promise<Set<number>> {
  const list = listDocument(db, listId);
  const [queue, dismissed] = await Promise.all([
    list.collection('queue').select().get(),
    list.collection('dismissed').select().get(),
  ]);
  const ids = new Set<number>();
  for (const doc of [...queue.docs, ...dismissed.docs]) {
    const tmdbId = Number(doc.id);
    if (Number.isInteger(tmdbId) && tmdbId > 0) ids.add(tmdbId);
  }
  return ids;
}

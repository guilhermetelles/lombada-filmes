import {
  type DocumentReference,
  type Firestore,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
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

/** O que a dupla já respondeu sobre filmes fora da lista, do mais recente para o mais antigo. */
export type ListFeedback = { queued: number[]; dismissed: number[] };

/**
 * Lê a fila "Quero ver" e os filmes marcados como "Não quero" (o id do documento é o id do TMDb nas
 * duas coleções), do mais recente para o mais antigo. Lê sem orderBy e ordena aqui, para um
 * documento sem a data não sumir da leitura (e voltar a ser sugerido).
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @returns Os ids do TMDb da fila e dos dispensados.
 */
export async function readListFeedback(db: Firestore, listId: string): Promise<ListFeedback> {
  const list = listDocument(db, listId);
  const [queue, dismissed] = await Promise.all([
    list.collection('queue').select('createdAt').get(),
    list.collection('dismissed').select('at').get(),
  ]);
  return { queued: newestIds(queue.docs, 'createdAt'), dismissed: newestIds(dismissed.docs, 'at') };
}

/**
 * Ids do TMDb dos documentos, do mais recente para o mais antigo (sem data, no fim).
 *
 * @param docs - Documentos cujo id é o id do TMDb.
 * @param field - Campo com a data.
 * @returns Os ids válidos.
 */
function newestIds(docs: readonly QueryDocumentSnapshot[], field: string): number[] {
  const millis = (doc: QueryDocumentSnapshot) => {
    const value = doc.get(field);
    return value instanceof Timestamp ? value.toMillis() : 0;
  };
  return [...docs]
    .sort((a, b) => millis(b) - millis(a))
    .map((doc) => Number(doc.id))
    .filter((tmdbId) => Number.isInteger(tmdbId) && tmdbId > 0);
}

import type { Firestore, Query } from 'firebase-admin/firestore';
import { writeInBatches } from '../firestore/write-in-batches.js';
import { brazilDay } from '../time/brazil-day.js';
import { DAY_MS } from '../time/durations.js';
import type { CleanupCount } from '../types/maintenance.js';

/** Itens da Atividade com mais de 180 dias são apagados. */
export const FEED_MAX_AGE_DAYS = 180;

/** Registros de notificação diária (notifyLog) com mais de 45 dias são apagados. */
export const NOTIFY_LOG_MAX_AGE_DAYS = 45;

/** Contagens diárias de limite (rateLimits) com mais de 45 dias são apagadas. */
export const RATE_LIMIT_MAX_AGE_DAYS = 45;

/** Máximo de documentos apagados por coleção numa execução; o resto fica para o dia seguinte. */
export const CLEANUP_LIMIT_PER_RUN = 500;

/**
 * Apaga o que já não serve: itens da Atividade de todas as listas (collectionGroup('feed') por
 * createdAt) com mais de 180 dias, notifyLog com sentAt de mais de 45 dias e rateLimits com day de
 * mais de 45 dias. Cada consulta traz no máximo `limit` documentos, sem os campos (select()), e
 * apaga em lotes; o que passar do limite fica para a próxima execução.
 *
 * @param db - Firestore.
 * @param now - Momento de referência.
 * @param limit - Máximo de documentos por coleção nesta execução.
 * @returns Quantos documentos de cada coleção foram apagados.
 */
async function deleteOldRecords(db: Firestore, now: Date, limit = CLEANUP_LIMIT_PER_RUN): Promise<CleanupCount> {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const [feed, notifyLog, rateLimits] = await Promise.all([
    deleteMatching(db, db.collectionGroup('feed').where('createdAt', '<', before(FEED_MAX_AGE_DAYS)), limit),
    deleteMatching(db, db.collection('notifyLog').where('sentAt', '<', before(NOTIFY_LOG_MAX_AGE_DAYS)), limit),
    deleteMatching(
      db,
      db.collection('rateLimits').where('day', '<', brazilDay(before(RATE_LIMIT_MAX_AGE_DAYS))),
      limit,
    ),
  ]);
  return { feed, notifyLog, rateLimits };
}

/**
 * Apaga até `limit` documentos de uma consulta.
 *
 * @param db - Firestore.
 * @param query - Consulta dos documentos vencidos.
 * @param limit - Máximo de documentos.
 * @returns Quantos foram apagados.
 */
async function deleteMatching(db: Firestore, query: Query, limit: number): Promise<number> {
  const snapshot = await query.select().limit(limit).get();
  await writeInBatches(db, snapshot.docs, (batch, doc) => batch.delete(doc.ref));
  return snapshot.size;
}

export { deleteOldRecords };

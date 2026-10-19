import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import { EntrySchema } from '../schemas/entry.js';
import type { Entry } from '../types/entry.js';

/** Uma entrada da lista com o id do documento e a posição no ranking (1 é o primeiro). */
export type RankedEntry = Entry & { entryId: string; position: number };

/**
 * Lê todas as entradas da lista na ordem do ranking (uma consulta por rankKey) e numera as
 * posições. Uma entrada fora do formato fica de fora, registrada no log, e não ocupa posição.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @returns As entradas, da primeira para a última.
 */
async function readRankedEntries(db: Firestore, listId: string): Promise<RankedEntry[]> {
  const snapshot = await db.collection(`lists/${listId}/entries`).orderBy('rankKey').get();
  const entries: RankedEntry[] = [];
  for (const doc of snapshot.docs) {
    const parsed = EntrySchema.safeParse(doc.data());
    if (!parsed.success) {
      logger.warn('entrada fora do formato, pulada', { listId, entryId: doc.id });
      continue;
    }
    entries.push({ ...parsed.data, entryId: doc.id, position: entries.length + 1 });
  }
  return entries;
}

/**
 * Lê só as entradas pedidas (um getAll) e a posição de cada uma no ranking, sem ler a lista
 * inteira: a posição é 1 + quantas entradas têm rankKey menor, contada pelo Firestore com count()
 * (uma leitura por consulta), e o tamanho da lista também vem de count(). Entrada que não existe
 * ou está fora do formato fica de fora (a fora do formato vai para o log).
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param entryIds - Entradas pedidas (repetidas contam uma vez).
 * @returns As entradas encontradas, com a posição, e quantas entradas a lista tem.
 */
async function readEntriesWithPositions(
  db: Firestore,
  listId: string,
  entryIds: readonly string[],
): Promise<{ entries: RankedEntry[]; total: number }> {
  const collection = db.collection(`lists/${listId}/entries`);
  const ids = [...new Set(entryIds)];
  const snapshots = ids.length > 0 ? await db.getAll(...ids.map((entryId) => collection.doc(entryId))) : [];
  const found = snapshots.flatMap((snapshot) => {
    if (!snapshot.exists) return [];
    const parsed = EntrySchema.safeParse(snapshot.data());
    if (parsed.success) return [{ ...parsed.data, entryId: snapshot.id }];
    logger.warn('entrada fora do formato, pulada', { listId, entryId: snapshot.id });
    return [];
  });

  const [total, ...before] = await Promise.all([
    collection.count().get(),
    ...found.map((entry) => collection.where('rankKey', '<', entry.rankKey).count().get()),
  ]);
  const entries = found.map((entry, index) => ({ ...entry, position: (before[index]?.data().count ?? 0) + 1 }));
  return { entries, total: total?.data().count ?? entries.length };
}

export { readEntriesWithPositions, readRankedEntries };

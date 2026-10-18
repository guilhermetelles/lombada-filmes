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

export { readRankedEntries };

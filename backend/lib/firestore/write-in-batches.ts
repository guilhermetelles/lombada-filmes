import type { Firestore, WriteBatch } from 'firebase-admin/firestore';

/** Máximo de operações num lote de gravação do Firestore. */
const FIRESTORE_BATCH_LIMIT = 500;

/**
 * Grava uma operação por item, em lotes de até 500 (o limite do Firestore).
 *
 * @param db - Firestore.
 * @param items - Itens a gravar.
 * @param write - Põe a operação de um item no lote (por exemplo, batch.delete(item.ref)).
 */
async function writeInBatches<T>(
  db: Firestore,
  items: T[],
  write: (batch: WriteBatch, item: T) => void,
): Promise<void> {
  for (let start = 0; start < items.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const item of items.slice(start, start + FIRESTORE_BATCH_LIMIT)) write(batch, item);
    await batch.commit();
  }
}

export { writeInBatches };

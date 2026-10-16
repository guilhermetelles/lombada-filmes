import type { Firestore } from 'firebase-admin/firestore';
import { writeInBatches } from '../firestore/write-in-batches.js';
import type { MovieSnapshot } from '../types/movie.js';
import { isSameSnapshot } from './movie-snapshot.js';

/**
 * Atualiza a cópia resumida em todas as entradas, de qualquer lista, que usam esse filme. Só as
 * entradas desatualizadas são regravadas, em lotes de até 500. A consulta usa o índice
 * collectionGroup de entries por tmdbId (firebase/firestore.indexes.json).
 *
 * @param db - Firestore.
 * @param tmdbId - Id do filme no TMDb.
 * @param snapshot - Cópia resumida atual.
 */
async function syncEntrySnapshots(db: Firestore, tmdbId: number, snapshot: MovieSnapshot): Promise<void> {
  const entries = await db.collectionGroup('entries').where('tmdbId', '==', tmdbId).get();
  const outdated = entries.docs.filter((entry) => !isSameSnapshot(snapshot, entry.get('movie')));

  await writeInBatches(db, outdated, (batch, entry) => batch.update(entry.ref, { movie: snapshot }));
}

export { syncEntrySnapshots };

import type { Firestore } from 'firebase-admin/firestore';
import { readRankedEntries } from '../events/list-entries.js';
import { logger } from '../logging/logger.js';
import { MovieSchema } from '../schemas/movie.js';
import type { List } from '../types/list.js';
import type { Movie } from '../types/movie.js';
import type { DailyList } from './daily-content.js';
import { isDay } from './day-math.js';

/** Quantos documentos pedir por getAll. */
const GET_ALL_CHUNK = 300;

/**
 * Lê o que a notificação diária usa de uma lista: as entradas na ordem do ranking e os filmes
 * delas. A data de estreia vem do campo `release` (AAAA-MM-DD) de movies/{tmdbId}, quando existir.
 * Filme fora do formato fica de fora, registrado no log.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param list - Documento da lista.
 * @returns Entradas, filmes e datas de estreia.
 */
async function loadDailyList(db: Firestore, listId: string, list: List): Promise<DailyList> {
  const entries = await readRankedEntries(db, listId);
  const tmdbIds = [...new Set(entries.map((entry) => entry.tmdbId))];
  const movies = new Map<number, Movie>();
  const releases = new Map<number, string>();

  for (let start = 0; start < tmdbIds.length; start += GET_ALL_CHUNK) {
    const chunk = tmdbIds.slice(start, start + GET_ALL_CHUNK);
    const snapshots = await db.getAll(...chunk.map((tmdbId) => db.doc(`movies/${tmdbId}`)));
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const tmdbId = Number(snapshot.id);
      const parsed = MovieSchema.safeParse(snapshot.data());
      if (!parsed.success) {
        logger.warn('filme fora do formato, fora da notificação diária', { tmdbId });
        continue;
      }
      movies.set(tmdbId, parsed.data);
      const release: unknown = snapshot.get('release');
      if (isDay(release)) releases.set(tmdbId, release);
    }
  }
  return { listId, list, entries, movies, releases };
}

export { loadDailyList };

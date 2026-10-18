import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import { MovieSchema } from '../schemas/movie.js';
import { RecsModelSchema } from '../schemas/recs.js';
import type { RecsModel } from '../types/recs.js';

/** Quantos filmes do topo da lista definem os gêneros preferidos. */
export const TASTE_TOP_ENTRIES = 20;

/** Limite do operador `in` do Firestore. */
const IN_QUERY_LIMIT = 30;

/**
 * Lê os gêneros dos primeiros filmes da lista (entries por rankKey, e o gênero de movies/{tmdbId}).
 * Filme sem documento ou fora do formato fica de fora.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @returns Os gêneros de cada um, na ordem do ranking.
 */
export async function readTopGenres(db: Firestore, listId: string): Promise<string[][]> {
  const entries = await db
    .collection(`lists/${listId}/entries`)
    .orderBy('rankKey')
    .limit(TASTE_TOP_ENTRIES)
    .select('tmdbId')
    .get();
  const tmdbIds = entries.docs.map((entry) => entry.get('tmdbId')).filter((id): id is number => typeof id === 'number');
  if (tmdbIds.length === 0) return [];

  const movies = await db.getAll(...tmdbIds.map((id) => db.doc(`movies/${id}`)));
  return movies.flatMap((movie) => {
    if (!movie.exists) return [];
    const parsed = MovieSchema.safeParse(movie.data());
    if (parsed.success) return [parsed.data.genres];
    logger.warn('filme fora do formato, fora do gosto da lista', { tmdbId: movie.id });
    return [];
  });
}

/**
 * Lê o modelo de compatibilidade de lists/{listId}/recs/current, quando a rotina recs já gravou um.
 * Só o campo `model` é lido e validado, para um item fora do formato não tirar o modelo.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @returns O modelo, ou undefined se não houver (ou estiver fora do formato).
 */
export async function readRecsModel(db: Firestore, listId: string): Promise<RecsModel | undefined> {
  const snapshot = await db.doc(`lists/${listId}/recs/current`).get();
  if (!snapshot.exists) return undefined;
  const parsed = RecsModelSchema.safeParse(snapshot.get('model'));
  if (parsed.success) return parsed.data;
  logger.warn('modelo de recs/current fora do formato, ignorado', { listId });
  return undefined;
}

/**
 * Acha as entradas da lista que já têm algum destes filmes.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param tmdbIds - Filmes procurados.
 * @returns O id da entrada de cada filme que está na lista.
 */
export async function findEntryIdsByTmdbIds(
  db: Firestore,
  listId: string,
  tmdbIds: readonly number[],
): Promise<Map<number, string>> {
  const found = new Map<number, string>();
  const unique = [...new Set(tmdbIds)];
  for (let start = 0; start < unique.length; start += IN_QUERY_LIMIT) {
    const chunk = unique.slice(start, start + IN_QUERY_LIMIT);
    const entries = await db.collection(`lists/${listId}/entries`).where('tmdbId', 'in', chunk).select('tmdbId').get();
    for (const entry of entries.docs) {
      const tmdbId = entry.get('tmdbId');
      if (typeof tmdbId === 'number' && !found.has(tmdbId)) found.set(tmdbId, entry.id);
    }
  }
  return found;
}

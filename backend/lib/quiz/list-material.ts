import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import { findMovies } from '../movies/movie-repository.js';
import { QuizEntryFieldsSchema } from '../schemas/quiz-material.js';
import type { List } from '../types/list.js';
import type { Movie } from '../types/movie.js';

/** Uma entrada da lista com a posição no ranking e o filme completo, quando guardado. */
export type RankedEntry = {
  entryId: string;
  rank: number; // 1 é o primeiro do ranking
  tmdbId: number;
  watchedOn: string | null; // AAAA-MM-DD
  comment: string;
  title: string; // em inglês, como no app
  year: number | null;
  posterPath: string | null;
  movie: Movie | undefined; // movies/{tmdbId}; ausente se o documento faltar ou estiver fora do formato
};

/** Tudo o que os geradores do quiz e a retrospectiva leem de uma lista. */
export type ListMaterial = {
  listId: string;
  entries: RankedEntry[]; // na ordem do ranking
  memberNames: string[]; // nomes dos membros, tirados dos textos antes de irem ao Gemini
};

/**
 * Lê as entradas da lista na ordem do ranking e os filmes delas numa ida só ao banco. Entrada fora
 * do formato fica de fora (registrada no log), sem derrubar a rotina.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param list - Documento da lista, já lido (para os nomes dos membros).
 * @returns As entradas com posição e filme, e os nomes dos membros.
 */
async function loadListMaterial(db: Firestore, listId: string, list: List): Promise<ListMaterial> {
  const snapshot = await db.collection(`lists/${listId}/entries`).orderBy('rankKey').get();
  const valid = snapshot.docs.flatMap((doc) => {
    const parsed = QuizEntryFieldsSchema.safeParse(doc.data());
    if (parsed.success) return [{ entryId: doc.id, ...parsed.data }];
    logger.warn('entrada fora do formato, fora do quiz', { listId, entryId: doc.id });
    return [];
  });
  const movies = await findMovies(db, [...new Set(valid.map((entry) => entry.tmdbId))]);

  const entries = valid.map(
    (entry, index): RankedEntry => ({
      entryId: entry.entryId,
      rank: index + 1,
      tmdbId: entry.tmdbId,
      watchedOn: entry.watchedOn,
      comment: entry.comment,
      title: movies.get(entry.tmdbId)?.title ?? entry.movie.title,
      year: movies.get(entry.tmdbId)?.year ?? entry.movie.year,
      posterPath: movies.get(entry.tmdbId)?.posterPath ?? entry.movie.posterPath,
      movie: movies.get(entry.tmdbId),
    }),
  );
  const memberNames = Object.values(list.memberProfiles ?? {})
    .map((profile) => profile.name)
    .filter((name) => name.length > 0);
  return { listId, entries, memberNames };
}

export { loadListMaterial };

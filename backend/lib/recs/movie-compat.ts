import type { Firestore } from 'firebase-admin/firestore';
import { scoreWithModel } from '../discover/score-candidates.js';
import { requireMember } from '../lists/list-access.js';
import { listDocument } from '../lists/list-repository.js';
import type { MovieCompat } from '../types/discover.js';
import type { Movie } from '../types/movie.js';
import { movieFeatures } from './movie-features.js';
import { readRecs } from './recs-repository.js';

/** Quem pede, a lista e o filme. */
type CompatRequest = { uid: string; listId: string; tmdbId: number; movie: Movie };

/**
 * Compatibilidade de um filme com a lista, para GET /api/movies/{tmdbId}?listId=. Se o filme está
 * entre as sugestões guardadas, devolve a nota e o motivo de lá (os mesmos da aba Sugestões); se foi
 * pontuado pela rotina mas está fora da vez na rotação, a nota e o motivo guardados em `scores`; senão,
 * pontua com o modelo de recs/current (mesmas variáveis da busca avançada), com o motivo pelas
 * variáveis que mais pesam. Sem modelo guardado, não há compatibilidade.
 *
 * @param db - Firestore.
 * @param request - Quem pede, a lista, o id e o documento do filme.
 * @returns A compatibilidade, ou undefined sem modelo.
 * @throws {NotFoundError} Se a lista não existir.
 * @throws {ForbiddenError} Se a pessoa não for integrante da lista.
 */
async function movieCompat(
  db: Firestore,
  { uid, listId, tmdbId, movie }: CompatRequest,
): Promise<MovieCompat | undefined> {
  requireMember((await listDocument(db, listId).get()).data(), uid);
  const stored = await readRecs(db, listId);
  if (!stored) return undefined;

  const { recs } = stored;
  const item = [...recs.items, ...recs.trending].find((rec) => rec.tmdbId === tmdbId);
  if (item) return { score: Math.round(item.score), reason: item.reason };
  const scored = recs.scores?.[String(tmdbId)];
  if (scored) return { score: Math.round(scored.score), reason: scored.reason };
  return scoreWithModel(recs.model, movieFeatures(movie));
}

export { movieCompat };

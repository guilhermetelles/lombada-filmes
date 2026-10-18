import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import { findMovies } from '../movies/movie-repository.js';
import type { Movie } from '../types/movie.js';
import type { RecItem, RecsModel } from '../types/recs.js';
import { fitFromIndex, withMovies } from './compute-list-recs.js';
import { diversify } from './diversify.js';
import { similarityTags } from './movie-features.js';
import { readListFilms, readRecs, recsDocument } from './recs-repository.js';
import { buildListIndex, type ListIndex, scoreMovie } from './score-recs.js';
import { MODEL_VERSION } from './train-model.js';

/** Código gRPC do Firestore para a pré-condição que falhou (o documento mudou no meio). */
const FAILED_PRECONDITION = 9;

/**
 * Avisa o motor de sugestões que a lista mudou (filme entrou, saiu ou mudou de posição): reajusta
 * o modelo com o ranking atual e repontua os itens guardados em recs/current, lendo só o Firestore
 * (sem TMDb nem Gemini). Os motivos, a origem e o agrupamento ficam; sai da sugestão o filme que
 * entrou na lista; a ordem é refeita com a variedade. Sem recs/current (lista nova, antes da
 * primeira rotina), não faz nada. Se a rotina gravar no meio, a gravação daqui é descartada (a da
 * rotina já usa o ranking novo). Nunca lança: uma falha vai para o log.
 *
 * @param db - Banco.
 * @param listId - Lista que mudou.
 * @returns Promessa resolvida quando o reajuste terminar.
 */
async function onListChanged(db: Firestore, listId: string): Promise<void> {
  try {
    const stored = await readRecs(db, listId);
    if (!stored) return;
    const films = await readListFilms(db, listId);
    const { items, trending } = stored.recs;
    const movies = await findMovies(db, [
      ...new Set([
        ...films.map((film) => film.tmdbId),
        ...items.map((item) => item.tmdbId),
        ...trending.map((item) => item.tmdbId),
      ]),
    ]);
    const index = buildListIndex(withMovies(films, movies), films.length);
    // Os rótulos das palavras-chave vêm da rotina: o reajuste não chama o Gemini.
    const labels = stored.recs.model.labels;
    const model = { ...fitFromIndex(index).model, ...(labels ? { labels } : {}) };
    const inList = new Set(films.map((film) => film.tmdbId));

    const rescore = (item: RecItem) => rescoreItem(item, movies.get(item.tmdbId), model, index);
    const nextItems = diversify(items.filter((item) => !inList.has(item.tmdbId)).map(rescore)).map(({ item }) => item);
    const nextTrending = trending
      .filter((item) => !inList.has(item.tmdbId))
      .map((item) => rescore(item).item)
      .sort((a, b) => b.score - a.score);

    await recsDocument(db, listId).update(
      { model, modelVersion: MODEL_VERSION, items: nextItems, trending: nextTrending },
      { lastUpdateTime: stored.updateTime },
    );
  } catch (error) {
    if (isFailedPrecondition(error)) {
      logger.info('recs/current mudou durante o reajuste; mantido o da rotina', { listId });
      return;
    }
    logger.error('falha ao reajustar as sugestões da lista', { listId, error });
  }
}

/**
 * Repontua um item guardado com o modelo novo, mantendo motivo, origem e agrupamento. Sem o
 * documento do filme, a nota fica a guardada.
 *
 * @param item - Item guardado.
 * @param movie - Documento do filme, se houver.
 * @param model - Modelo reajustado.
 * @param index - Índice da lista.
 * @returns O item repontuado e o que a variedade precisa.
 */
function rescoreItem(item: RecItem, movie: Movie | undefined, model: RecsModel, index: ListIndex) {
  if (!movie) return { item, score: item.score, groups: [], tags: new Map<string, number>() };
  const rec = scoreMovie(model, index, item.tmdbId, movie, item.source);
  return { item: { ...item, score: rec.score }, score: rec.score, groups: rec.groups, tags: similarityTags(movie) };
}

/**
 * Diz se o erro do Firestore é a pré-condição de update() que falhou.
 *
 * @param error - Erro lançado.
 * @returns true para FAILED_PRECONDITION.
 */
function isFailedPrecondition(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === FAILED_PRECONDITION;
}

export { onListChanged };

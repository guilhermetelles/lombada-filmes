import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import { readRecs, recsDocument } from './recs-repository.js';

/** Código gRPC do Firestore para a pré-condição que falhou (o documento mudou no meio). */
const FAILED_PRECONDITION = 9;

/**
 * Avisa o motor de sugestões que filmes entraram na lista: tira esses filmes de `items`, de
 * `trending` e de `scores` em recs/current, mantendo a ordem, as notas e os motivos dos outros. Lê um documento
 * só (recs/current); reajustar o modelo pedia a lista inteira e todos os filmes dela (centenas de
 * leituras por lote), então o reajuste pelo ranking novo fica com a rotina recs, uma vez por dia.
 * Sem filme novo ou sem recs/current (lista nova, antes da primeira rotina), não faz nada. Se a
 * rotina gravar no meio, a gravação daqui é descartada (a da rotina já usa a lista nova). Nunca
 * lança: uma falha vai para o log.
 *
 * @param db - Banco.
 * @param listId - Lista que mudou.
 * @param entered - Filmes (ids do TMDb) que entraram na lista.
 * @returns Promessa resolvida quando a gravação terminar.
 */
async function onListChanged(db: Firestore, listId: string, entered: readonly number[]): Promise<void> {
  if (entered.length === 0) return;
  try {
    const stored = await readRecs(db, listId);
    if (!stored) return;
    const inList = new Set(entered);
    const { items, trending, scores = {} } = stored.recs;
    const nextItems = items.filter((item) => !inList.has(item.tmdbId));
    const nextTrending = trending.filter((item) => !inList.has(item.tmdbId));
    const nextScores = Object.fromEntries(Object.entries(scores).filter(([tmdbId]) => !inList.has(Number(tmdbId))));
    if (
      nextItems.length === items.length &&
      nextTrending.length === trending.length &&
      Object.keys(nextScores).length === Object.keys(scores).length
    ) {
      return;
    }

    await recsDocument(db, listId).update(
      { items: nextItems, trending: nextTrending, ...(stored.recs.scores ? { scores: nextScores } : {}) },
      { lastUpdateTime: stored.updateTime },
    );
  } catch (error) {
    if (isFailedPrecondition(error)) {
      logger.info('recs/current mudou durante o ajuste; mantido o da rotina', { listId });
      return;
    }
    logger.error('falha ao tirar das sugestões os filmes que entraram na lista', { listId, error });
  }
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

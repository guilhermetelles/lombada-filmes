import type { Budget, PhaseProgress } from '../types/enrich.js';

/**
 * Trata ids em ordem crescente, em lotes, a partir do cursor. Antes de cada lote confere o tempo;
 * o tratamento do lote pode parar antes do fim (cota da OMDb) devolvendo quantos ids tratou.
 *
 * @param ids - Ids da etapa, em ordem crescente.
 * @param after - Último id tratado numa execução anterior, ou null para começar do início.
 * @param batchSize - Ids por lote.
 * @param budget - Tempo da execução.
 * @param handleBatch - Trata um lote e devolve quantos ids do começo dele tratou.
 * @returns Se a etapa terminou e o último id tratado.
 */
async function processInOrder(
  ids: number[],
  after: number | null,
  batchSize: number,
  budget: Budget,
  handleBatch: (batch: number[]) => Promise<number>,
): Promise<PhaseProgress> {
  const pending = after === null ? ids : ids.filter((id) => id > after);
  let last = after;
  for (let start = 0; start < pending.length; start += batchSize) {
    if (budget.expired()) return { completed: false, last };
    const batch = pending.slice(start, start + batchSize);
    const handled = await handleBatch(batch);
    if (handled > 0) last = batch[handled - 1] ?? last;
    if (handled < batch.length) return { completed: false, last };
  }
  return { completed: true, last };
}

export { processInOrder };

import { listsCollection } from '../lists/list-repository.js';
import { logger } from '../logging/logger.js';
import type { Dependencies } from '../types/dependencies.js';
import type { List } from '../types/list.js';
import type { UsageRecorder } from '../types/usage.js';
import { computeListRecs, type ListRecsReport } from './compute-list-recs.js';
import { readRecs } from './recs-repository.js';
import { createRecsRun, DEFAULT_RECS_LIMITS, type RecsLimits } from './recs-run.js';

/** Relatório da rotina recs. */
export type RecsReport = {
  lists: ListRecsReport[];
  failed: string[]; // listas em que o cálculo falhou
  skipped: string[]; // listas que ficaram para a próxima execução (tempo esgotado)
  tmdbCalls: number;
};

/**
 * Rotina recs: calcula recs/current de cada lista, das que estão há mais tempo sem cálculo para as
 * mais recentes (lista sem documento primeiro). Com o tempo esgotado, as que faltam ficam para a
 * próxima execução, que começa por elas. A falha numa lista vai para o log e não para as outras.
 *
 * @param dependencies - Banco, fontes e relógio.
 * @param usage - Medidor de consumo do pedido.
 * @param limits - Tempo, candidatos e pedidos ao TMDb da execução.
 * @returns O que foi feito.
 */
async function runRecs(
  dependencies: Dependencies,
  usage: UsageRecorder,
  limits: RecsLimits = DEFAULT_RECS_LIMITS,
): Promise<RecsReport> {
  const run = createRecsRun(dependencies, usage, limits);
  const report: RecsReport = { lists: [], failed: [], skipped: [], tmdbCalls: 0 };

  for (const { listId, list } of await listsByOldestRecs(dependencies)) {
    if (run.expired()) {
      report.skipped.push(listId);
      continue;
    }
    try {
      report.lists.push(await computeListRecs(run, listId, list));
    } catch (error) {
      logger.error('falha ao calcular as sugestões da lista', { listId, error });
      report.failed.push(listId);
    }
  }
  report.tmdbCalls = run.tmdbCallsMade();
  return report;
}

/**
 * Lê todas as listas e ordena pela data do último cálculo das sugestões (sem cálculo primeiro).
 *
 * @param dependencies - Banco.
 * @returns As listas, na ordem de cálculo.
 */
async function listsByOldestRecs({ db }: Dependencies): Promise<{ listId: string; list: List }[]> {
  const lists = await listsCollection(db).get();
  const withDates = await Promise.all(
    lists.docs.map(async (doc) => {
      let list: List;
      try {
        list = doc.data();
      } catch (error) {
        logger.warn('lista fora do formato, sem sugestões', { listId: doc.id, error });
        return [];
      }
      const recs = await readRecs(db, doc.id);
      return [{ listId: doc.id, list, computedAt: recs?.recs.computedAt.getTime() ?? 0 }];
    }),
  );
  return withDates.flat().sort((a, b) => a.computedAt - b.computedAt || a.listId.localeCompare(b.listId));
}

export { runRecs };

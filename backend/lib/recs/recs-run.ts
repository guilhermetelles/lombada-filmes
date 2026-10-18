import type { Dependencies } from '../types/dependencies.js';
import type { UsageRecorder } from '../types/usage.js';

/** Limites de uma execução da rotina recs. */
export type RecsLimits = {
  budgetMs: number; // para de buscar no TMDb depois disso (a função tem 300 s)
  maxCandidates: number; // candidatos buscados por lista
  tmdbCalls: number; // pedidos ao TMDb na execução inteira
  batchSize: number; // pedidos ao TMDb ao mesmo tempo
};

/** Limites de produção: 240 s, 80 candidatos por lista, 400 pedidos ao TMDb, 6 de cada vez. */
export const DEFAULT_RECS_LIMITS: RecsLimits = { budgetMs: 240_000, maxCandidates: 80, tmdbCalls: 400, batchSize: 6 };

/** Uma execução: dependências, medidor que conta os pedidos ao TMDb, limites e o relógio. */
export type RecsRun = {
  dependencies: Dependencies;
  usage: UsageRecorder;
  limits: RecsLimits;
  startedAt: Date;
  /** Se ainda dá para pedir ao TMDb (tempo e pedidos). */
  canFetch(): boolean;
  /** Se o tempo da execução acabou. */
  expired(): boolean;
  /** Pedidos ao TMDb feitos até agora. */
  tmdbCallsMade(): number;
};

/**
 * Monta uma execução da rotina, com um medidor que repassa tudo ao medidor do pedido e conta os
 * pedidos de verdade ao TMDb (acertos no banco não contam).
 *
 * @param dependencies - Banco, fontes e relógio.
 * @param usage - Medidor de consumo do pedido.
 * @param limits - Limites da execução.
 * @returns A execução.
 */
function createRecsRun(dependencies: Dependencies, usage: UsageRecorder, limits: RecsLimits): RecsRun {
  const startedAt = dependencies.now();
  let tmdbCalls = 0;
  const expired = () => dependencies.now().getTime() - startedAt.getTime() >= limits.budgetMs;
  return {
    dependencies,
    limits,
    startedAt,
    usage: {
      count: (source, outcome) => usage.count(source, outcome),
      track: (source, call) => {
        if (source === 'tmdb') tmdbCalls += 1;
        return usage.track(source, call);
      },
    },
    canFetch: () => !expired() && tmdbCalls < limits.tmdbCalls,
    expired,
    tmdbCallsMade: () => tmdbCalls,
  };
}

export { createRecsRun };

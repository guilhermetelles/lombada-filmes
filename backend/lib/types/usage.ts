import type { SourceName } from './sources.js';

/** Contadores gravados em usage/{yyyy-mm-dd}.{fonte}, que alimentam a tela de consumo das APIs. */
export type UsageOutcome = 'calls' | 'errors' | 'cacheHits';

/** O que as rotas usam para contar o consumo durante um pedido (implementado por UsageMeter). */
export type UsageRecorder = {
  count(source: SourceName, outcome: UsageOutcome): void;
  track<T>(source: SourceName, call: () => Promise<T>): Promise<T>;
};

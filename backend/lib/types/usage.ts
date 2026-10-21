import type { SourceName } from './sources.js';

/** Contadores gravados em usage/{yyyy-mm-dd}.{fonte}, que alimentam a tela de consumo das APIs. */
export type UsageOutcome = 'calls' | 'errors' | 'cacheHits';

/** Contadores de cada modelo do Gemini em usage/{dia}.geminiModels.{modelo}; `quota` conta os 429. */
export type GeminiModelOutcome = 'calls' | 'errors' | 'quota';

/** O que as rotas usam para contar o consumo durante um pedido (implementado por UsageMeter). */
export type UsageRecorder = {
  count(source: SourceName, outcome: UsageOutcome): void;
  track<T>(source: SourceName, call: () => Promise<T>): Promise<T>;
  /** Conta um pedido, erro ou 429 de um modelo do Gemini. */
  countGeminiModel(model: string, outcome: GeminiModelOutcome): void;
  /** Pula um modelo do Gemini até o momento dado (o 429 diz quando a cota volta). */
  skipGeminiModel(model: string, until: Date): void;
  /** Modelos do Gemini a pular agora: os gravados em quotas/gemini e os desta execução, ainda no prazo. */
  geminiModelsToSkip(): Promise<ReadonlySet<string>>;
  /** Modelos do Gemini que responderam 429 nesta execução. */
  geminiQuotaHits(): string[];
};

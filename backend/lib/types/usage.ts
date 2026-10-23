import type { SourceName } from './sources.js';

/** Contadores gravados em usage/{yyyy-mm-dd}.{fonte}, que alimentam a tela de consumo das APIs. */
export type UsageOutcome = 'calls' | 'errors' | 'cacheHits';

/**
 * Contadores de cada modelo do Gemini em usage/{dia}.geminiModels.{modelo}: pedidos, respostas e
 * erros, os erros por tipo (`quota` 429, `unavailable` 5xx/404, `timeout` tempo limite ou rede,
 * `format` resposta fora do formato) e `latencyMs`, a soma do tempo das respostas.
 */
export type GeminiModelOutcome =
  | 'calls'
  | 'answered'
  | 'errors'
  | 'quota'
  | 'unavailable'
  | 'timeout'
  | 'format'
  | 'latencyMs';

/** Para que o backend pede ao Gemini: busca em texto livre, sugestões, quiz ou retrospectiva. */
export type GeminiPurpose = 'search' | 'recs' | 'quiz' | 'retro';

/** Contadores de cada uso em usage/{dia}.geminiPurposes.{uso}: pedidos, respondidos e falhos (depois de todos os modelos). */
export type GeminiPurposeOutcome = 'requests' | 'answered' | 'failed';

/** Por que um modelo do Gemini está sendo pulado: sem cota (429) ou fora do ar (5xx, 404, tempo limite). */
export type GeminiSkipReason = 'quota' | 'unavailable';

/** O que as rotas usam para contar o consumo durante um pedido (implementado por UsageMeter). */
export type UsageRecorder = {
  count(source: SourceName, outcome: UsageOutcome): void;
  track<T>(source: SourceName, call: () => Promise<T>): Promise<T>;
  /** Soma a um contador de um modelo do Gemini (1, ou os milissegundos em `latencyMs`). */
  countGeminiModel(model: string, outcome: GeminiModelOutcome, amount?: number): void;
  /** Conta um pedido, resposta ou falha de um uso do Gemini. */
  countGeminiPurpose(purpose: GeminiPurpose, outcome: GeminiPurposeOutcome): void;
  /** Pula um modelo do Gemini até o momento dado, guardando o motivo. */
  skipGeminiModel(model: string, until: Date, reason: GeminiSkipReason): void;
  /** Modelos do Gemini a pular agora: os gravados em quotas/gemini e os desta execução, ainda no prazo. */
  geminiModelsToSkip(): Promise<ReadonlySet<string>>;
  /** Modelos do Gemini que responderam 429 nesta execução. */
  geminiQuotaHits(): string[];
};

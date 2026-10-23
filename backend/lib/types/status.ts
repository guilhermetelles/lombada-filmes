import type { JobName, JobStatus } from './jobs.js';
import type { SourceName } from './sources.js';
import type { GeminiPurpose, GeminiSkipReason } from './usage.js';

/** Resposta de GET /api/status: saúde das rotinas, consumo dos últimos 7 dias e os modelos do Gemini. */

/** Saúde de uma rotina, como a rota devolve (datas em ISO 8601). */
export type JobStatusItem = {
  name: JobName;
  lastRunAt: string;
  durationMs: number;
  status: JobStatus;
  summary: string;
  warnings: string[];
};

/** Pedidos e erros de uma fonte num dia. */
export type SourceUsage = { calls: number; errors: number };

/**
 * Consumo de um modelo do Gemini num dia: pedidos, respostas, erros e os erros por tipo (`quota`
 * 429, `unavailable` 5xx/404, `timeout` tempo limite ou rede, `format` resposta fora do formato) e
 * `latencyMs`, a soma do tempo das respostas (a média é latencyMs / answered).
 */
export type GeminiModelUsage = {
  calls: number;
  answered: number;
  errors: number;
  quota: number;
  unavailable: number;
  timeout: number;
  format: number;
  latencyMs: number;
};

/** Pedidos de um uso do Gemini num dia, e quantos foram respondidos ou falharam depois de todos os modelos. */
export type GeminiPurposeUsage = { requests: number; answered: number; failed: number };

/** Modelo do Gemini sendo pulado agora: até quando (ISO 8601) e por quê. */
export type GeminiRestingModel = { model: string; until: string; reason: GeminiSkipReason };

/** Consumo de um dia (fuso de Brasília). */
export type UsageDayStatus = {
  day: string;
  sources: Partial<Record<SourceName, SourceUsage>>;
  geminiModels: Record<string, GeminiModelUsage>;
  geminiPurposes: Partial<Record<GeminiPurpose, GeminiPurposeUsage>>;
};

/** Modelos do Gemini em uso, na ordem de preferência, os que estão sendo pulados e a explicação da cota grátis. */
export type GeminiStatus = {
  interpret: string[];
  text: string[];
  resting: GeminiRestingModel[];
  dailyLimitNote: string;
};

/** Corpo de GET /api/status. */
export type StatusResponse = {
  jobs: JobStatusItem[];
  usage: UsageDayStatus[]; // os últimos 7 dias, do mais recente para o mais antigo
  gemini: GeminiStatus;
};

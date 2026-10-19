import type { JobName, JobStatus } from './jobs.js';
import type { SourceName } from './sources.js';

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

/** Pedidos, erros e respostas 429 (cota esgotada) de um modelo do Gemini num dia. */
export type GeminiModelUsage = { calls: number; errors: number; quota: number };

/** Consumo de um dia (fuso de Brasília). */
export type UsageDayStatus = {
  day: string;
  sources: Partial<Record<SourceName, SourceUsage>>;
  geminiModels: Record<string, GeminiModelUsage>;
};

/** Modelos do Gemini em uso, na ordem de preferência, e a explicação da cota grátis. */
export type GeminiStatus = {
  interpret: string[];
  text: string[];
  dailyLimitNote: string;
};

/** Corpo de GET /api/status. */
export type StatusResponse = {
  jobs: JobStatusItem[];
  usage: UsageDayStatus[]; // os últimos 7 dias, do mais recente para o mais antigo
  gemini: GeminiStatus;
};

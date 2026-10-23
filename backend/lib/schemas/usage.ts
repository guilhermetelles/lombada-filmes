import * as z from 'zod';
import type { SourceName } from '../types/sources.js';
import type { GeminiModelUsage, GeminiPurposeUsage, SourceUsage } from '../types/status.js';
import type { GeminiPurpose, GeminiSkipReason } from '../types/usage.js';

/** Fontes que podem aparecer em usage/{dia}, na ordem da tela de consumo. */
export const SOURCE_NAMES = [
  'tmdb',
  'omdb',
  'letterboxd',
  'bechdel',
  'wikidata',
  'wikipedia',
  'gemini',
] as const satisfies readonly SourceName[];

/** Contador gravado com FieldValue.increment; ausente ou fora do formato conta 0. */
const counter = z.number().nonnegative().catch(0).default(0);

/** usage/{dia}.{fonte}: só pedidos e erros (acertos de cache e cota ficam de fora do status). */
export const SourceUsageSchema: z.ZodType<SourceUsage> = z.object({ calls: counter, errors: counter });

/** Contador que pode faltar: dias gravados antes de ele existir. */
const optionalCounter = z.number().nonnegative().optional().catch(undefined);

/** Modelo zerado, para entrada fora do formato. */
const EMPTY_MODEL: GeminiModelUsage = {
  calls: 0,
  answered: 0,
  errors: 0,
  quota: 0,
  unavailable: 0,
  timeout: 0,
  format: 0,
  latencyMs: 0,
};

/**
 * usage/{dia}.geminiModels.{modelo}. Dias gravados antes de `answered` existir têm as respostas
 * deduzidas dos pedidos menos os erros.
 */
export const GeminiModelUsageSchema: z.ZodType<GeminiModelUsage> = z
  .object({
    calls: counter,
    answered: optionalCounter,
    errors: counter,
    quota: counter,
    unavailable: counter,
    timeout: counter,
    format: counter,
    latencyMs: counter,
  })
  .transform(({ answered, ...usage }) => ({ ...usage, answered: answered ?? Math.max(0, usage.calls - usage.errors) }));

/** usage/{dia}.geminiModels: um mapa por modelo; entrada fora do formato fica zerada. */
export const GeminiModelsUsageSchema = z.record(z.string(), GeminiModelUsageSchema.catch(EMPTY_MODEL)).catch({});

/** Usos do Gemini que aparecem em usage/{dia}.geminiPurposes. */
export const GEMINI_PURPOSES = ['search', 'recs', 'quiz', 'retro'] as const satisfies readonly GeminiPurpose[];

/** usage/{dia}.geminiPurposes.{uso}. */
export const GeminiPurposeUsageSchema: z.ZodType<GeminiPurposeUsage> = z.object({
  requests: counter,
  answered: counter,
  failed: counter,
});

/** Motivo gravado em quotas/gemini.skipReason; prazo gravado antes do motivo existir conta como cota. */
export const GeminiSkipReasonSchema: z.ZodType<GeminiSkipReason> = z.enum(['quota', 'unavailable']).catch('quota');

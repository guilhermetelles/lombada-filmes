import * as z from 'zod';
import type { SourceName } from '../types/sources.js';
import type { GeminiModelUsage, SourceUsage } from '../types/status.js';

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

/** usage/{dia}.geminiModels.{modelo}. */
export const GeminiModelUsageSchema: z.ZodType<GeminiModelUsage> = z.object({
  calls: counter,
  errors: counter,
  quota: counter,
});

/** usage/{dia}.geminiModels: um mapa por modelo; entrada fora do formato fica zerada. */
export const GeminiModelsUsageSchema = z
  .record(z.string(), GeminiModelUsageSchema.catch({ calls: 0, errors: 0, quota: 0 }))
  .catch({});

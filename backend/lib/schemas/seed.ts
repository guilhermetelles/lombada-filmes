import * as z from 'zod';
import type { OriginalListInfo } from '../types/seed.js';

/** Item de state.list no mock (mock/index.html). */
export const MockEntrySchema = z.object({
  id: z.number().int().positive(),
  movieId: z.string().min(1),
  date: z.iso.date().nullable(),
  comment: z.string(),
});

/** Lista do mock com os filmes na ordem do ranking. */
export const MockListSchema = z.array(MockEntrySchema).min(1);

/** Lista do mock (const LISTS), só o que a carga usa. */
export const MockListInfoSchema: z.ZodType<OriginalListInfo> = z.object({
  name: z.string().min(1),
  description: z.string(),
});

/** mock/data/real.json: dados reais de cada filme do mock; a carga só precisa do id do TMDb. */
export const MockCatalogSchema = z.record(z.string(), z.looseObject({ tmdbId: z.number().int().positive().nullish() }));

/** Variáveis que só o script de carga usa. */
export const SeedEnvSchema = z.object({
  OWNER_UID: z.string().min(1, 'OWNER_UID (uid da dona da lista) é obrigatório'),
});

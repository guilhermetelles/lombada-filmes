import * as z from 'zod';
import type { Retro } from '../types/retro.js';
import { BrazilMonthSchema } from './dates.js';
import { firestoreDate } from './firestore.js';

/** lists/{listId}/retros/{mês}, validado ao ler. */
export const RetroSchema: z.ZodType<Retro> = z.object({
  month: BrazilMonthSchema,
  films: z.number().int().nonnegative(),
  minutes: z.number().nonnegative(),
  bestEntryId: z.string().nullable(),
  worstEntryId: z.string().nullable(),
  genres: z.array(z.tuple([z.string(), z.number().int()])),
  text: z.string().nullable(),
  generatedAt: firestoreDate,
});

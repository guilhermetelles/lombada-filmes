import * as z from 'zod';
import type { Duel, DuelChoice } from '../types/duel.js';
import { BrazilDaySchema } from './dates.js';
import { firestoreDate } from './firestore.js';

/** Voto de um membro. */
export const DuelChoiceSchema: z.ZodType<DuelChoice> = z.enum(['keep', 'swap'], "choice deve ser 'keep' ou 'swap'");

/** lists/{listId}/duels/{dia}, validado ao ler. */
export const DuelSchema: z.ZodType<Duel> = z.object({
  day: BrazilDaySchema,
  entryIdA: z.string(),
  entryIdB: z.string(),
  votes: z.record(z.string(), DuelChoiceSchema),
  status: z.enum(['open', 'kept', 'swapped']),
  createdAt: firestoreDate,
  resolvedAt: firestoreDate.optional(),
});

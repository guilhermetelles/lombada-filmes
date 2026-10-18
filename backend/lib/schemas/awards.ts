import * as z from 'zod';
import type { AwardItem, Awards } from '../types/awards.js';
import { firestoreDate } from './firestore.js';

/** Um prêmio ou uma indicação; categoria e ano podem faltar. */
export const AwardItemSchema: z.ZodType<AwardItem> = z.object({
  org: z.string().min(1),
  cat: z.string().nullable(),
  kind: z.enum(['win', 'nom']),
  year: z.number().int().nullable(),
  for: z.string().nullable().optional(),
});

/** Campo awards de movies/{tmdbId} e people/{id}. */
export const AwardsSchema: z.ZodType<Awards> = z.object({
  items: z.array(AwardItemSchema),
  summary: z.string().nullable(),
  fetchedAt: firestoreDate,
});

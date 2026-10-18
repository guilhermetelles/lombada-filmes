import * as z from 'zod';
import type { EnrichCursor } from '../types/enrich.js';
import { firestoreDate } from './firestore.js';

/** jobs/enrich, validado ao ler. */
export const EnrichCursorSchema: z.ZodType<EnrichCursor> = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phase: z.enum(['providers', 'movies', 'people', 'done']),
  after: z.number().int().nullable(),
  updatedAt: firestoreDate,
});

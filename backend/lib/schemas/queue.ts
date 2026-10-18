import * as z from 'zod';
import type { Dismissed, QueueItem } from '../types/queue.js';
import { firestoreDate } from './firestore.js';

/** lists/{listId}/queue/{tmdbId}, validado ao ler. */
export const QueueItemSchema: z.ZodType<QueueItem> = z.object({
  tmdbId: z.number().int().positive(),
  addedBy: z.string(),
  createdAt: firestoreDate,
});

/** lists/{listId}/dismissed/{tmdbId}, validado ao ler. */
export const DismissedSchema: z.ZodType<Dismissed> = z.object({
  by: z.string(),
  at: firestoreDate,
});

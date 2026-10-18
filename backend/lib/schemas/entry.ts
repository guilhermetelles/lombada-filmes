import * as z from 'zod';
import type { Entry } from '../types/entry.js';
import { firestoreDate } from './firestore.js';
import { MovieSnapshotSchema } from './movie.js';

/** lists/{listId}/entries/{entryId}, validado ao ler (o app grava, as regras conferem o formato). */
export const EntrySchema: z.ZodType<Entry> = z.object({
  tmdbId: z.number().int(),
  rankKey: z.string(),
  watchedOn: z.string().nullable(),
  comment: z.string(),
  addedBy: z.string(),
  updatedBy: z.string(),
  createdAt: firestoreDate,
  updatedAt: firestoreDate,
  movie: MovieSnapshotSchema,
});

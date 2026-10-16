import * as z from 'zod';
import type { Person } from '../types/person.js';
import { firestoreDate } from './firestore.js';

/** people/{tmdbPersonId}, validado ao ler. */
export const PersonSchema: z.ZodType<Person> = z.object({
  name: z.string(),
  birthday: z.string().nullable(),
  deathday: z.string().nullable(),
  placeOfBirth: z.string().nullable(),
  biography: z.string().nullable(),
  bioLang: z.enum(['pt', 'en']).nullable(),
  profilePath: z.string().nullable(),
  imdbId: z.string().nullable(),
  directedCount: z.number().int(),
  directed: z.array(z.object({ tmdbId: z.number().int(), title: z.string(), year: z.number().int().nullable() })),
  fetchedAt: firestoreDate,
});

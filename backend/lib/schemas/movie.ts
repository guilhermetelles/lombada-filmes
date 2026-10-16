import * as z from 'zod';
import type { Movie, MovieSnapshot } from '../types/movie.js';
import { firestoreDate } from './firestore.js';

const rating = { value: z.number().nullable(), fetchedAt: firestoreDate };

/** Referência a uma pessoa do TMDb dentro de um filme. */
export const PersonRefSchema = z.object({ id: z.number().int(), name: z.string() });

/** movies/{tmdbId}, validado ao ler. A anotação garante que o schema produz exatamente o tipo Movie. */
export const MovieSchema: z.ZodType<Movie> = z.object({
  title: z.string(),
  year: z.number().int().nullable(),
  directors: z.array(PersonRefSchema),
  runtime: z.number().nullable(),
  genres: z.array(z.string()),
  synopsis: z.object({ pt: z.string().nullable(), en: z.string().nullable() }),
  posterPath: z.string().nullable(),
  ids: z.object({ imdb: z.string().nullable(), letterboxd: z.string().nullable() }),
  ratings: z.object({
    letterboxd: z.object({ ...rating, count: z.number().nullable() }).optional(),
    imdb: z.object({ ...rating, votes: z.number().nullable() }).optional(),
    rottenTomatoes: z.object({ ...rating, url: z.string().nullable() }).optional(),
    metacritic: z.object(rating).optional(),
  }),
  tmdbFetchedAt: firestoreDate,
});

/** Cópia resumida como está gravada em lists/{listId}/entries/{entryId}.movie. */
export const MovieSnapshotSchema: z.ZodType<MovieSnapshot> = z.object({
  title: z.string(),
  year: z.number().nullable(),
  posterPath: z.string().nullable(),
  imdb: z.number().nullable(),
  letterboxd: z.number().nullable(),
  directors: z.array(PersonRefSchema),
});

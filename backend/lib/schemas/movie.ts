import { Timestamp } from 'firebase-admin/firestore';
import * as z from 'zod';
import type { Movie, MovieSnapshot } from '../types/movie.js';

/** No banco as datas são Timestamp; no código, Date (o Admin SDK converte Date ao gravar). */
const date = z.union([z.instanceof(Timestamp).transform((timestamp) => timestamp.toDate()), z.date()]);

const rating = { value: z.number().nullable(), fetchedAt: date };

/** movies/{tmdbId}, validado ao ler. A anotação garante que o schema produz exatamente o tipo Movie. */
export const MovieSchema: z.ZodType<Movie> = z.object({
  title: z.string(),
  year: z.number().int().nullable(),
  directors: z.array(z.string()),
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
  tmdbFetchedAt: date,
});

/** Cópia resumida como está gravada em lists/{listId}/entries/{entryId}.movie. */
export const MovieSnapshotSchema: z.ZodType<MovieSnapshot> = z.object({
  title: z.string(),
  year: z.number().nullable(),
  posterPath: z.string().nullable(),
  imdb: z.number().nullable(),
  letterboxd: z.number().nullable(),
});

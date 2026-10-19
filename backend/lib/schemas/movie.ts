import * as z from 'zod';
import type { Bechdel, Movie, MovieCollection, MovieRecInfo, MovieSnapshot, ProvidersBR } from '../types/movie.js';
import { AwardsSchema } from './awards.js';
import { BrazilDaySchema } from './dates.js';
import { firestoreDate } from './firestore.js';
import { CastMemberSchema, DirectorSchema, PersonRefSchema } from './person.js';

/** Campos comuns a toda nota: valor e data da busca. */
const rating = { value: z.number().nullable(), fetchedAt: firestoreDate };

/** movies/{tmdbId}.bechdel: Teste de Bechdel do bechdeltest.com. */
export const BechdelSchema: z.ZodType<Bechdel> = z.object({
  siteId: z.number().int().nullable(),
  url: z.string().nullable(),
  rating: z.number().int().min(0).max(3).nullable(),
  dubious: z.boolean(),
  disputes: z.number().int().nonnegative(),
  fetchedAt: firestoreDate,
});

/** movies/{tmdbId}.collection: saga do TMDb. */
export const MovieCollectionSchema: z.ZodType<MovieCollection> = z.object({ id: z.number().int(), name: z.string() });

/** Um item de movies/{tmdbId}.recsInfo: filme recomendado pelo TMDb, resumido. */
export const MovieRecInfoSchema: z.ZodType<MovieRecInfo> = z.object({
  tmdbId: z.number().int(),
  title: z.string(),
  titleEn: z.string().optional(),
  year: z.number().int().nullable(),
  posterPath: z.string().nullable(),
});

/** movies/{tmdbId}.providersBR: streaming por assinatura no Brasil. */
export const ProvidersBRSchema: z.ZodType<ProvidersBR> = z.object({
  flatrate: z.array(z.string()),
  previous: z.array(z.string()),
  fetchedAt: firestoreDate,
});

/** movies/{tmdbId}, validado ao ler. A anotação garante que o schema produz exatamente o tipo Movie. */
export const MovieSchema: z.ZodType<Movie> = z.object({
  title: z.string(),
  year: z.number().int().nullable(),
  directors: z.array(DirectorSchema),
  // Filmes gravados antes do passo 9 não têm elenco; contam como vazio (os da lista já foram recarregados).
  cast: z.array(CastMemberSchema).default([]),
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
  bechdel: BechdelSchema.optional(),
  titlePt: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  budget: z.number().nullable().optional(),
  revenue: z.number().nullable().optional(),
  boxOfficeUS: z.number().nullable().optional(),
  certBR: z.string().nullable().optional(),
  collection: MovieCollectionSchema.nullable().optional(),
  keywords: z.array(z.string()).max(25).optional(),
  recs: z.array(z.number().int()).max(10).optional(),
  recsInfo: z.array(MovieRecInfoSchema).max(10).optional(),
  release: BrazilDaySchema.nullable().optional(),
  providersBR: ProvidersBRSchema.optional(),
  awards: AwardsSchema.optional(),
  popularity: z.number().optional(),
  vote: z.number().nullable().optional(),
  votes: z.number().int().optional(),
  extraFetchedAt: firestoreDate.optional(),
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

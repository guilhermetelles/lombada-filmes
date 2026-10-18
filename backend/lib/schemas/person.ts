import * as z from 'zod';
import type { CastMember, Director, Person, PersonRef } from '../types/person.js';
import { AwardsSchema } from './awards.js';
import { firestoreDate } from './firestore.js';

/** Referência a uma pessoa do TMDb dentro de um filme (diretores). */
export const PersonRefSchema: z.ZodType<PersonRef> = z.object({ id: z.number().int(), name: z.string() });

/** Quem dirigiu um filme, como fica em movies/{tmdbId}.directors (foto ausente nos filmes antigos). */
export const DirectorSchema: z.ZodType<Director> = z.object({
  id: z.number().int(),
  name: z.string(),
  profilePath: z.string().nullable().optional(),
});

/** Pessoa do elenco de um filme, como fica em movies/{tmdbId}.cast. */
export const CastMemberSchema: z.ZodType<CastMember> = z.object({
  id: z.number().int(),
  name: z.string(),
  character: z.string().nullable(),
  profilePath: z.string().nullable(),
});

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
  // Fichas gravadas antes do passo 9 não têm os filmes atuados; contam como zero até a próxima busca.
  actedCount: z.number().int().default(0),
  acted: z
    .array(
      z.object({
        tmdbId: z.number().int(),
        title: z.string(),
        year: z.number().int().nullable(),
        character: z.string().nullable(),
      }),
    )
    .default([]),
  fetchedAt: firestoreDate,
  awards: AwardsSchema.optional(),
});

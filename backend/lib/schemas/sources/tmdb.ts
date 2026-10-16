import * as z from 'zod';
import { optionalText } from './common.js';

// Formato das respostas do TMDb, só com os campos que o app usa.

/** "1989-08-09" vira 1989; data ausente ou vazia vira null. */
const releaseYear = z
  .string()
  .nullish()
  .transform((date) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null));

const Translation = z.object({
  iso_639_1: z.string(), // idioma
  iso_3166_1: z.string(), // país
  data: z.object({ title: optionalText, overview: optionalText }),
});

/** Resposta de /movie/{id}?append_to_response=credits,external_ids,translations. */
export const TmdbMovieResponse = z.object({
  id: z.number(),
  title: optionalText,
  original_title: optionalText,
  overview: optionalText,
  poster_path: optionalText,
  release_date: releaseYear,
  runtime: z.number().nullish(),
  genres: z.array(z.object({ name: z.string() })).default([]),
  credits: z.object({ crew: z.array(z.object({ id: z.number(), job: z.string(), name: z.string() })) }).optional(),
  external_ids: z.object({ imdb_id: optionalText }).optional(),
  translations: z.object({ translations: z.array(Translation) }).optional(),
});

export type TmdbMovieResponse = z.output<typeof TmdbMovieResponse>;

/** Resposta de /search/movie. */
export const TmdbSearchResponse = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      title: optionalText,
      original_title: optionalText,
      overview: optionalText,
      poster_path: optionalText,
      release_date: releaseYear,
    }),
  ),
});

export type TmdbSearchResponse = z.output<typeof TmdbSearchResponse>;

const PersonTranslation = z.object({
  iso_639_1: z.string(), // idioma
  iso_3166_1: z.string(), // país
  data: z.object({ biography: optionalText }),
});

/** Resposta de /person/{id}?language=en-US&append_to_response=movie_credits,external_ids,translations. */
export const TmdbPersonResponse = z.object({
  id: z.number(),
  name: z.string(),
  birthday: optionalText,
  deathday: optionalText,
  place_of_birth: optionalText,
  biography: optionalText, // em inglês, pelo language=en-US
  profile_path: optionalText,
  imdb_id: optionalText,
  movie_credits: z
    .object({
      crew: z.array(
        z.object({
          id: z.number(),
          job: z.string(),
          title: optionalText,
          original_title: optionalText,
          release_date: releaseYear,
          popularity: z.number().default(0),
        }),
      ),
    })
    .optional(),
  translations: z.object({ translations: z.array(PersonTranslation) }).optional(),
});

export type TmdbPersonResponse = z.output<typeof TmdbPersonResponse>;

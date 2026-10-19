import * as z from 'zod';
import { optionalText } from './common.js';

/** Formato das respostas do TMDb usadas pela busca avançada, só com os campos que ela usa. */

/** Um filme numa lista paginada do TMDb (/discover/movie, /trending/movie/week). */
export const TmdbListedMovie = z.object({
  id: z.number().int().positive(),
  title: optionalText,
  original_title: optionalText,
  original_language: optionalText,
  poster_path: optionalText,
  release_date: optionalText,
  genre_ids: z.array(z.number()).default([]),
  vote_average: z.number().nullish(),
  vote_count: z.number().nullish(),
  popularity: z.number().nullish(),
});

/** Resposta paginada de /discover/movie e /trending/movie/week. */
export const TmdbMoviePage = z.object({
  page: z.number().int(),
  total_pages: z.number().int(),
  total_results: z.number().int(),
  results: z.array(TmdbListedMovie),
});

/** Resposta de /movie/{id}?append_to_response=watch/providers,keywords (só o que a busca usa). */
export const TmdbMovieExtrasResponse = z.object({
  id: z.number().int(),
  runtime: z.number().nullish(),
  keywords: z.object({ keywords: z.array(z.object({ id: z.number(), name: z.string() })).default([]) }).optional(),
  'watch/providers': z
    .object({
      results: z.record(
        z.string(),
        z.object({ flatrate: z.array(z.object({ provider_id: z.number(), provider_name: z.string() })).optional() }),
      ),
    })
    .optional(),
});

/** Resposta de /search/keyword (só o que a busca usa). */
export const TmdbKeywordSearchResponse = z.object({
  results: z.array(z.object({ id: z.number().int(), name: z.string() })).default([]),
});

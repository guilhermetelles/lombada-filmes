import * as z from 'zod';
import { BrazilDaySchema } from '../dates.js';
import { optionalText } from './common.js';

/** Formato das respostas do TMDb, só com os campos que o app usa. */

/** "1989-08-09" vira 1989; data ausente ou vazia vira null. */
export const releaseYear = z
  .string()
  .nullish()
  .transform((date) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null));

/**
 * "1989-08-09" fica como está; data ausente, vazia ou fora do formato AAAA-MM-DD vira null (o
 * mesmo formato que movies/{tmdbId}.release exige ao ler).
 */
export const releaseDay = z
  .string()
  .nullish()
  .transform((date) => (BrazilDaySchema.safeParse(date).success ? (date ?? null) : null));

/** Um filme resumido nas recomendações de /movie/{id}: o que a fileira de parecidos mostra. */
const Recommendation = z.object({
  id: z.number(),
  title: optionalText,
  original_title: optionalText,
  poster_path: optionalText,
  release_date: releaseYear,
});

/** Tradução de filme no TMDb; só título e sinopse interessam. */
const Translation = z.object({
  iso_639_1: z.string(), // idioma
  iso_3166_1: z.string(), // país
  data: z.object({ title: optionalText, overview: optionalText }),
});

/** Pessoa do elenco nos créditos de um filme; `order` é a posição nos créditos. */
const CastCredit = z.object({
  id: z.number(),
  name: z.string(),
  character: optionalText,
  order: z.number().default(Number.MAX_SAFE_INTEGER),
  profile_path: optionalText,
});

/** Data de estreia num país, em release_dates; a classificação vem vazia quando o país não tem. */
const ReleaseDate = z.object({ certification: optionalText });

/** Serviços de um país em watch/providers; só a assinatura (flatrate) interessa. */
const CountryProviders = z.object({
  flatrate: z.array(z.object({ provider_name: z.string() })).default([]),
});

/**
 * Resposta de /movie/{id}?append_to_response=credits,external_ids,translations,keywords,
 * recommendations,watch/providers,release_dates. Os campos extras (versão 0.3) são opcionais para
 * aceitar respostas montadas nos testes sem eles.
 */
export const TmdbMovieResponse = z.object({
  id: z.number(),
  title: optionalText,
  tagline: optionalText,
  budget: z.number().nullish(),
  revenue: z.number().nullish(),
  popularity: z.number().default(0),
  vote_average: z.number().default(0),
  vote_count: z.number().default(0),
  belongs_to_collection: z.object({ id: z.number(), name: z.string() }).nullish(),
  keywords: z.object({ keywords: z.array(z.object({ name: z.string() })).default([]) }).optional(),
  recommendations: z.object({ results: z.array(Recommendation).default([]) }).optional(),
  'watch/providers': z.object({ results: z.record(z.string(), CountryProviders).default({}) }).optional(),
  release_dates: z
    .object({
      results: z.array(z.object({ iso_3166_1: z.string(), release_dates: z.array(ReleaseDate).default([]) })),
    })
    .optional(),
  original_title: optionalText,
  overview: optionalText,
  poster_path: optionalText,
  release_date: optionalText, // texto como veio: o mapeamento tira o ano e a data AAAA-MM-DD
  runtime: z.number().nullish(),
  genres: z.array(z.object({ name: z.string() })).default([]),
  credits: z
    .object({
      crew: z.array(z.object({ id: z.number(), job: z.string(), name: z.string(), profile_path: optionalText })),
      cast: z.array(CastCredit).default([]),
    })
    .optional(),
  external_ids: z.object({ imdb_id: optionalText }).optional(),
  translations: z.object({ translations: z.array(Translation) }).optional(),
});

/** Resposta de /movie/{id} já validada. */
export type TmdbMovieResponse = z.output<typeof TmdbMovieResponse>;

/** Elenco de um filme já validado. */
export type TmdbCastCredit = z.output<typeof CastCredit>;

/** Um filme da coleção (saga) em /collection/{id}. */
const CollectionPart = z.object({
  id: z.number(),
  title: optionalText,
  original_title: optionalText,
  release_date: releaseDay,
});

/** Resposta de /collection/{id}: a saga e os filmes dela, na ordem do TMDb. */
export const TmdbCollectionResponse = z.object({
  id: z.number(),
  name: z.string(),
  parts: z.array(CollectionPart).default([]),
});

/** Resposta de /collection/{id} já validada. */
export type TmdbCollectionResponse = z.output<typeof TmdbCollectionResponse>;

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

/** Resposta de /search/movie já validada. */
export type TmdbSearchResponse = z.output<typeof TmdbSearchResponse>;

/** Tradução de pessoa no TMDb; só a biografia interessa. */
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
      cast: z
        .array(
          z.object({
            id: z.number(),
            title: optionalText,
            original_title: optionalText,
            release_date: releaseYear,
            character: optionalText,
            vote_count: z.number().default(0),
          }),
        )
        .default([]),
    })
    .optional(),
  translations: z.object({ translations: z.array(PersonTranslation) }).optional(),
});

/** Resposta de /person/{id} já validada. */
export type TmdbPersonResponse = z.output<typeof TmdbPersonResponse>;

/** Resposta de /search/person, só com o que a lista de resultados usa. */
export const TmdbPersonSearchResponse = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      known_for_department: optionalText,
      profile_path: optionalText,
      // Filmes usam title; séries, name.
      known_for: z.array(z.object({ title: optionalText, name: optionalText })).default([]),
    }),
  ),
});

/** Resposta de /search/person já validada. */
export type TmdbPersonSearchResponse = z.output<typeof TmdbPersonSearchResponse>;

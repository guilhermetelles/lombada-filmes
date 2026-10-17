import * as z from 'zod';

/**
 * Formato bruto das respostas que scripts/record-fixtures.ts grava. Só as partes que o script
 * enxuga são tipadas; o resto passa como veio (looseObject mantém os campos desconhecidos).
 */

/** Resposta de /movie/{id} que o script grava, enxugando créditos e traduções. */
export const TmdbDetailsToRecord = z.looseObject({
  credits: z.looseObject({
    crew: z.array(z.looseObject({ job: z.string() })),
    cast: z.array(z.looseObject({ order: z.number() })),
  }),
  translations: z.looseObject({ translations: z.array(z.looseObject({ iso_639_1: z.string() })) }),
});

/** Resposta de /movie/{id}/credits que o script grava, só com o começo do elenco. */
export const TmdbCreditsToRecord = z.looseObject({ cast: z.array(z.looseObject({ order: z.number() })) });

/** Resposta de /search/movie que o script grava, só com os primeiros resultados. */
export const TmdbSearchToRecord = z.looseObject({ results: z.array(z.looseObject({ id: z.number() })) });

/** Resposta de /person/{id} que o script grava, enxugando créditos e traduções. */
export const TmdbPersonToRecord = z.looseObject({
  movie_credits: z.looseObject({
    crew: z.array(z.looseObject({ job: z.string() })),
    cast: z.array(z.looseObject({})),
  }),
  translations: z.looseObject({ translations: z.array(z.looseObject({ iso_639_1: z.string() })) }),
});

/** Resposta de /search/person que o script grava como veio. */
export const TmdbPersonSearchToRecord = z.looseObject({ results: z.array(z.looseObject({ id: z.number() })) });

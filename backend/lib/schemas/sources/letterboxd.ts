import * as z from 'zod';

/** Bloco JSON-LD (schema.org/Movie) da página de um filme do Letterboxd, só com o que o app usa. */
export const FilmJsonLd = z.object({
  url: z.url().optional(),
  aggregateRating: z
    .object({
      ratingValue: z.number().optional(),
      ratingCount: z.number().optional(),
    })
    .optional(),
});

export type FilmJsonLd = z.output<typeof FilmJsonLd>;

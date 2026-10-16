import * as z from 'zod';

/** A OMDb devolve números como texto ("7.5", "211,055", "75%") e "N/A" quando não tem o dado. */
export const omdbNumber = z
  .string()
  .optional()
  .transform((text) => {
    if (!text || text === 'N/A') return null;
    const value = Number(text.replace(/[,%]/g, ''));
    return Number.isFinite(value) ? value : null;
  });

/** A OMDb responde 200 até para erro; o campo Response diz qual dos dois formatos veio. */
export const OmdbResponse = z.discriminatedUnion('Response', [
  z.object({
    Response: z.literal('True'),
    imdbRating: omdbNumber,
    imdbVotes: omdbNumber,
    Metascore: omdbNumber,
    tomatoURL: z.string().optional(),
    Ratings: z.array(z.object({ Source: z.string(), Value: z.string() })).default([]),
  }),
  z.object({
    Response: z.literal('False'),
    Error: z.string().default('resposta inválida'),
  }),
]);

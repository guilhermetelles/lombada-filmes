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

/** Valores em dólar como texto ("$54,243,125"); "N/A", ausente ou zero vira null. */
export const omdbMoney = z
  .string()
  .optional()
  .transform((text) => {
    if (!text || text === 'N/A') return null;
    const value = Number(text.replace(/[$,\s]/g, ''));
    return Number.isFinite(value) && value > 0 ? value : null;
  });

/** Texto da OMDb em que "N/A", vazio ou ausente vira null. */
export const omdbText = z
  .string()
  .optional()
  .transform((text) => (!text || text.trim() === 'N/A' ? null : text.trim() || null));

/** A OMDb responde 200 até para erro; o campo Response diz qual dos dois formatos veio. */
export const OmdbResponse = z.discriminatedUnion('Response', [
  z.object({
    Response: z.literal('True'),
    imdbRating: omdbNumber,
    imdbVotes: omdbNumber,
    Metascore: omdbNumber,
    tomatoURL: z.string().optional(),
    Ratings: z.array(z.object({ Source: z.string(), Value: z.string() })).default([]),
    Awards: omdbText, // resumo em inglês: "Won 1 Oscar. 4 wins & 10 nominations total"
    BoxOffice: omdbMoney, // bilheteria nos EUA
  }),
  z.object({
    Response: z.literal('False'),
    Error: z.string().default('resposta inválida'),
  }),
]);

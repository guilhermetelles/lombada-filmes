import * as z from 'zod';
import type { BechdelIndexEntry } from '../../types/sources.js';

/** Critérios do Teste de Bechdel que o filme passa: de 0 a 3. */
const rating = z.number().int().min(0).max(3);

/** Um filme do índice, como o site grava: `[id, título, ano, critérios, duvidosa 0/1]`. */
const BechdelIndexTuple = z
  .tuple([z.number().int().positive(), z.string(), z.number().int(), rating, z.union([z.literal(0), z.literal(1)])])
  .transform(
    ([siteId, title, year, filmRating, dubious]): BechdelIndexEntry => ({
      siteId,
      title,
      year,
      rating: filmRating,
      dubious: dubious === 1,
    }),
  );

/**
 * https://bechdeltest.com/search/index.json: todos os filmes do site, que a busca do próprio site
 * usa. Um item fora do formato invalida o índice inteiro, para nunca casar com dado errado.
 */
export const BechdelIndex = z.array(BechdelIndexTuple);

/** O que a leitura por regex tira da página de um filme, conferido antes de usar. */
export const BechdelPageFields = z.object({
  imdbId: z
    .string()
    .regex(/^tt\d+$/)
    .nullable(),
  rating: z.coerce.number().pipe(rating),
  dubious: z.boolean(),
  disputes: z.number().int().nonnegative(),
});

/** Campos da página de um filme já conferidos. */
export type BechdelPageFields = z.output<typeof BechdelPageFields>;

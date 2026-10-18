import * as z from 'zod';

/**
 * Partes das respostas da versão 0.3 que scripts/record-fixtures.ts enxuga antes de gravar. O resto
 * passa como veio (looseObject mantém os campos desconhecidos).
 */

/** Campos extras de /movie/{id} que o script corta: recomendações, datas de estreia e streaming. */
export const TmdbExtrasToRecord = z.looseObject({
  keywords: z.looseObject({ keywords: z.array(z.looseObject({ name: z.string() })) }),
  recommendations: z.looseObject({ results: z.array(z.looseObject({ id: z.number(), title: z.string().optional() })) }),
  release_dates: z.looseObject({ results: z.array(z.looseObject({ iso_3166_1: z.string() })) }),
  'watch/providers': z.looseObject({ results: z.record(z.string(), z.unknown()) }),
});

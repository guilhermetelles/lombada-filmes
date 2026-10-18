import * as z from 'zod';

/** Formato da resposta de action=query&prop=categories da Wikipedia (formatversion=2). */

/** Troca de título feita pela API (normalização ou redirecionamento). */
const TitleChange = z.object({ from: z.string(), to: z.string() });

/** Resposta de categorias de vários artigos, com a continuação quando passa do limite. */
export const WikipediaCategoriesResponse = z.object({
  continue: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  query: z
    .object({
      normalized: z.array(TitleChange).default([]),
      redirects: z.array(TitleChange).default([]),
      pages: z
        .array(
          z.object({
            title: z.string(),
            missing: z.boolean().optional(),
            categories: z.array(z.object({ title: z.string() })).default([]),
          }),
        )
        .default([]),
    })
    .optional(),
});

/** Resposta de categorias já validada. */
export type WikipediaCategoriesResponse = z.output<typeof WikipediaCategoriesResponse>;

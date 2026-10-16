import * as z from 'zod';

// Entradas das rotas. As mensagens vão para o app na resposta 400.

/** GET /api/search?q= */
export const SearchQuery = z.object({
  q: z.string().trim().min(1, 'q é obrigatório').max(100, 'q pode ter até 100 caracteres'),
});

/** GET /api/movies/{tmdbId} */
export const MovieParams = z.object({
  tmdbId: z
    .string()
    .regex(/^[1-9]\d{0,7}$/, 'tmdbId deve ser um número inteiro positivo')
    .transform(Number),
});

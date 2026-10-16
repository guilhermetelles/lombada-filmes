import * as z from 'zod';

// Entradas das rotas. As mensagens vão para o app na resposta 400.

/** GET /api/search?q= */
export const SearchQuery = z.object({
  q: z.string().trim().min(1, 'q é obrigatório').max(100, 'q pode ter até 100 caracteres'),
});

/** Id de lista no caminho: /api/lists/{listId}/… (mesmo formato que firestore.rules aceita). */
export const ListParams = z.object({
  listId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'listId inválido'),
});

/** POST /api/lists */
export const CreateListBody = z.object({
  name: z.string('name é obrigatório').trim().min(1, 'name é obrigatório').max(80, 'name pode ter até 80 caracteres'),
  description: z.string().trim().max(280, 'description pode ter até 280 caracteres').default(''),
});

/** POST /api/lists/join. Aceita o código como o app mostra ("7Q4-KMX") ou digitado em minúsculas. */
export const JoinListBody = z.object({
  code: z
    .string('code é obrigatório')
    .transform((code) => code.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .pipe(z.string().length(6, 'code deve ter 6 caracteres')),
});

/** GET /api/movies/{tmdbId} */
export const MovieParams = z.object({
  tmdbId: z
    .string()
    .regex(/^[1-9]\d{0,7}$/, 'tmdbId deve ser um número inteiro positivo')
    .transform(Number),
});

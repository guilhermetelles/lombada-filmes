import * as z from 'zod';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '../lists/invite-codes.js';

/** Entradas das rotas. As mensagens vão para o app na resposta 400. */

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
    .transform(normalizeInviteCode)
    .pipe(z.string().length(INVITE_CODE_LENGTH, `code deve ter ${INVITE_CODE_LENGTH} caracteres`)),
});

/** GET /api/movies/{tmdbId} */
export const MovieParams = z.object({
  tmdbId: z
    .string()
    .regex(/^[1-9]\d{0,7}$/, 'tmdbId deve ser um número inteiro positivo')
    .transform(Number),
});

/** GET /api/people/{personId} */
export const PersonParams = z.object({
  personId: z
    .string()
    .regex(/^[1-9]\d{0,8}$/, 'personId deve ser um número inteiro positivo')
    .transform(Number),
});

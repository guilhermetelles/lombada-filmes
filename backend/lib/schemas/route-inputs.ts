import * as z from 'zod';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '../lists/invite-codes.js';
import { LAUNCH_QUIZ_ID } from '../quiz/launch-event.js';
import { BrazilDaySchema } from './dates.js';
import { DecSchema, DurSchema, MoodSchema, ThemeSchema } from './discover.js';
import { NotifyPrefsSchema } from './notify.js';
import { QuizOptionIdSchema } from './quiz.js';

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

/** GET /api/search/people?q= */
export const PersonSearchQuery = z.object({
  q: z.string().trim().min(2, 'q deve ter pelo menos 2 caracteres').max(100, 'q pode ter até 100 caracteres'),
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

/** Id do TMDb vindo do caminho, como texto. */
const tmdbIdText = z
  .string()
  .regex(/^[1-9]\d{0,7}$/, 'tmdbId deve ser um número inteiro positivo')
  .transform(Number);

/** Id do TMDb vindo de um corpo JSON. */
const tmdbIdNumber = z
  .number('tmdbId deve ser um número inteiro positivo')
  .int('tmdbId deve ser um número inteiro positivo')
  .positive('tmdbId deve ser um número inteiro positivo')
  .max(99_999_999, 'tmdbId deve ser um número inteiro positivo');

/** Id de entrada da lista (gerado pelo Firestore no app). */
const entryId = z.string('entryId é obrigatório').regex(/^[A-Za-z0-9_-]{1,64}$/, 'entryId inválido');

/** Token do FCM no corpo. */
const deviceToken = z
  .string('token é obrigatório')
  .min(1, 'token é obrigatório')
  .max(4096, 'token pode ter até 4096 caracteres');

/**
 * Lista separada por vírgulas na query, validada item a item. Ausente ou vazia vira undefined.
 *
 * @param item - Schema de cada item.
 * @returns Schema que aceita o texto da query e devolve o array (ou undefined).
 */
function commaList<Item extends z.ZodType>(item: Item) {
  return z.preprocess((text) => {
    if (typeof text !== 'string') return text;
    const parts = text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }, z.array(item).max(20, 'cada filtro aceita até 20 valores').optional());
}

/** GET /api/movies/{tmdbId}?listId=: a lista é opcional e liga a compatibilidade. */
export const MovieQuery = z.object({ listId: ListParams.shape.listId.optional() });

/** POST /api/me/devices */
export const RegisterDeviceBody = z.object({
  token: deviceToken,
  platform: z.literal('android', "platform deve ser 'android'"),
});

/** DELETE /api/me/devices */
export const UnregisterDeviceBody = z.object({ token: deviceToken });

/** PUT /api/me/notify */
export const NotifyPrefsBody = NotifyPrefsSchema;

/** GET /api/discover?listId=&mood=&dur=&dec=&genre=&theme=&svc=&fit=&page= (listas separadas por vírgula). */
export const DiscoverQuery = z.object({
  listId: ListParams.shape.listId.optional(),
  mood: commaList(MoodSchema),
  dur: commaList(DurSchema),
  dec: commaList(DecSchema),
  genre: commaList(z.string().max(40, 'genre pode ter até 40 caracteres')),
  theme: commaList(ThemeSchema),
  svc: commaList(z.string().max(60, 'svc pode ter até 60 caracteres')),
  fit: z
    .enum(['true', 'false'], "fit deve ser 'true' ou 'false'")
    .optional()
    .transform((fit) => (fit === undefined ? undefined : fit === 'true')),
  page: z
    .string()
    .regex(/^[1-9]\d{0,2}$/, 'page deve ser um número de 1 a 500')
    .transform(Number)
    .pipe(z.number().max(500, 'page deve ser um número de 1 a 500'))
    .optional()
    .transform((page) => page ?? 1),
});

/** POST /api/search/interpret */
export const InterpretBody = z.object({
  text: z
    .string('text é obrigatório')
    .trim()
    .min(2, 'text deve ter pelo menos 2 caracteres')
    .max(200, 'text pode ter até 200 caracteres'),
});

/** POST /api/lists/{listId}/queue */
export const AddToQueueBody = z.object({ tmdbId: tmdbIdNumber });

/** DELETE /api/lists/{listId}/queue/{tmdbId} */
export const QueueItemParams = z.object({ listId: ListParams.shape.listId, tmdbId: tmdbIdText });

/** POST /api/lists/{listId}/events: lote de até 50 eventos do app. */
export const ListEventsBody = z.object({
  items: z
    .array(
      z
        .object({
          type: z.enum(
            ['added', 'moved', 'commented', 'removed'],
            "type deve ser 'added', 'moved', 'commented' ou 'removed'",
          ),
          entryId,
          tmdbId: tmdbIdNumber.nullish(),
        })
        .refine((event) => event.type !== 'removed' || event.tmdbId != null, 'removed precisa de tmdbId'),
      'items é obrigatório',
    )
    .min(1, 'items deve ter pelo menos 1 evento')
    .max(50, 'items pode ter até 50 eventos'),
});

/** POST /api/lists/{listId}/quiz/{dia}/answer: caminho. */
export const QuizAnswerParams = z.object({
  listId: ListParams.shape.listId,
  day: z.union([BrazilDaySchema, z.string().regex(LAUNCH_QUIZ_ID)], 'dia deve ser AAAA-MM-DD ou inicio-01 a inicio-10'),
});

/** POST /api/lists/{listId}/quiz/{dia}/answer: corpo. */
export const QuizAnswerBody = z.object({ optionId: QuizOptionIdSchema });

import * as z from 'zod';
import type {
  QuizAnswer,
  QuizAnswerResult,
  QuizDoc,
  QuizKey,
  QuizMedia,
  QuizOption,
  QuizOptionId,
  QuizType,
  Scores,
} from '../types/quiz.js';
import { BrazilDaySchema } from './dates.js';
import { firestoreDate } from './firestore.js';

/** Tipo de pergunta. */
export const QuizTypeSchema: z.ZodType<QuizType> = z.enum([
  'diretor',
  'ano',
  'trecho',
  'poster',
  'ranking',
  'mes',
  'personagem',
  'emoji',
  'sinopse',
  'bechdel',
  'bilheteria',
  'premio',
]);

/** Id de uma alternativa. */
export const QuizOptionIdSchema: z.ZodType<QuizOptionId> = z.enum(['a', 'b', 'c', 'd']);

/** Uma alternativa. */
export const QuizOptionSchema: z.ZodType<QuizOption> = z.object({
  id: QuizOptionIdSchema,
  label: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
});

/** O que a pergunta mostra além do enunciado. */
export const QuizMediaSchema: z.ZodType<QuizMedia> = z.object({
  posterPath: z.string().optional(),
  crop: z.object({ x: z.number(), y: z.number(), zoom: z.number().positive() }).optional(),
  excerpt: z.string().optional(),
  emoji: z.string().optional(),
  synopsis: z.string().optional(),
});

/** lists/{listId}/quizzes/{dia}, validado ao ler. */
export const QuizDocSchema: z.ZodType<QuizDoc> = z.object({
  day: BrazilDaySchema,
  type: QuizTypeSchema,
  prompt: z.string().min(1),
  options: z.array(QuizOptionSchema).min(2).max(4),
  media: QuizMediaSchema.optional(),
  createdAt: firestoreDate,
  event: z.literal('inicio').optional(),
  eventIndex: z.number().int().min(1).max(10).optional(),
});

/** lists/{listId}/quizKeys/{dia}, validado ao ler. */
export const QuizKeySchema: z.ZodType<QuizKey> = z.object({
  rightOptionId: QuizOptionIdSchema,
  explanation: z.string(),
  tmdbId: z.number().int().optional(),
});

/** lists/{listId}/quizzes/{dia}/answers/{uid}, validado ao ler. */
export const QuizAnswerSchema: z.ZodType<QuizAnswer> = z.object({
  optionId: QuizOptionIdSchema,
  correct: z.boolean(),
  answeredAt: firestoreDate,
});

/** Saída da rota de resposta do quiz. */
export const QuizAnswerResultSchema: z.ZodType<QuizAnswerResult> = z.object({
  correct: z.boolean(),
  rightOptionId: QuizOptionIdSchema,
  explanation: z.string(),
  others: z.array(z.object({ uid: z.string(), correct: z.boolean(), optionId: QuizOptionIdSchema })),
});

/** lists/{listId}/scores/{mês}, validado ao ler. */
export const ScoresSchema: z.ZodType<Scores> = z.object({
  points: z.record(z.string(), z.number()),
  winnerUids: z.array(z.string()).optional(),
});

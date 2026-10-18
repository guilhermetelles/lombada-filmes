import * as z from 'zod';
import type { FeedItem, FeedKind, FeedType, RouteName, RouteRef } from '../types/feed.js';
import { BrazilDaySchema, BrazilMonthSchema } from './dates.js';
import { firestoreDate } from './firestore.js';

/** O que gerou um item da Atividade. */
export const FeedTypeSchema: z.ZodType<FeedType> = z.enum([
  'member.activity',
  'queue.added',
  'queue.removed',
  'quiz.result',
  'quiz.winner',
  'daily.quiz',
  'daily.curio',
  'daily.memory',
  'daily.retro',
  'daily.release',
  'daily.streaming',
  'daily.duel',
  'daily.milestone',
  'daily.releaseAnniversary',
  'daily.birthday',
]);

/** Grupo do item (e canal da notificação no Android). */
export const FeedKindSchema: z.ZodType<FeedKind> = z.enum(['lista', 'quiz', 'curiosidade', 'lembrete']);

/** Telas que um item ou uma notificação pode abrir. */
export const RouteNameSchema: z.ZodType<RouteName> = z.enum([
  'movie',
  'person',
  'quiz',
  'quizPlay',
  'queue',
  'recs',
  'feed',
  'listInfo',
  'retro',
  'duel',
  'memory',
  'reports',
]);

/** Tela a abrir, com os argumentos. */
export const RouteRefSchema: z.ZodType<RouteRef> = z.object({
  name: RouteNameSchema,
  args: z
    .object({
      tmdbId: z.number().int().positive().optional(),
      personId: z.number().int().positive().optional(),
      day: BrazilDaySchema.optional(),
      month: BrazilMonthSchema.optional(),
      entryId: z.string().optional(),
      entryIdB: z.string().optional(),
    })
    .optional(),
});

/** lists/{listId}/feed/{feedId}, validado ao ler e antes de gravar. */
export const FeedItemSchema: z.ZodType<FeedItem> = z.object({
  type: FeedTypeSchema,
  kind: FeedKindSchema,
  createdAt: firestoreDate,
  actorUid: z.string().optional(),
  title: z.string().min(1),
  body: z.string().optional(),
  quote: z.string().optional(),
  route: RouteRefSchema,
});

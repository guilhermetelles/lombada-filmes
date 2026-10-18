import * as z from 'zod';
import type { RecItem, RecKind, RecSource, RecsDoc, RecsModel } from '../types/recs.js';
import { firestoreDate } from './firestore.js';

/** Origem de uma sugestão. */
export const RecSourceSchema: z.ZodType<RecSource> = z.enum(['model', 'trending', 'nowPlaying']);

/** Agrupamento de uma sugestão. */
export const RecKindSchema: z.ZodType<RecKind> = z.enum(['saga', 'diretor', 'tema', 'emAlta']);

/** Um filme sugerido. */
export const RecItemSchema: z.ZodType<RecItem> = z.object({
  tmdbId: z.number().int().positive(),
  title: z.string(),
  year: z.number().int().nullable(),
  posterPath: z.string().nullable(),
  runtime: z.number().nullable(),
  genres: z.array(z.string()),
  providers: z.array(z.string()),
  score: z.number().min(0).max(100),
  reason: z.string(),
  reasonFrom: z.array(z.string()),
  reasonBy: z.enum(['gemini', 'rules']).optional(),
  source: RecSourceSchema,
  kind: RecKindSchema,
});

/** Modelo de compatibilidade (até 300 variáveis). */
export const RecsModelSchema: z.ZodType<RecsModel> = z.object({
  bias: z.number(),
  weights: z
    .record(z.string(), z.number())
    .refine((weights) => Object.keys(weights).length <= 300, 'o modelo pode ter até 300 variáveis'),
  labels: z.record(z.string(), z.string()).optional(),
});

/** lists/{listId}/recs/current, validado ao ler. */
export const RecsDocSchema: z.ZodType<RecsDoc> = z.object({
  computedAt: firestoreDate,
  modelVersion: z.string(),
  model: RecsModelSchema,
  items: z.array(RecItemSchema).max(30),
  trending: z.array(RecItemSchema).max(15),
});

/** Resposta pedida ao Gemini nos motivos das sugestões: um motivo por filme. */
export const RecReasonsReplySchema = z.object({
  reasons: z.array(z.object({ tmdbId: z.number().int(), reason: z.string() })),
});

/** Resposta pedida ao Gemini na tradução das palavras-chave: um rótulo por nome em inglês. */
export const KeywordLabelsReplySchema = z.object({
  labels: z.array(z.object({ name: z.string(), label: z.string() })),
});

import * as z from 'zod';
import type { Entry } from '../types/entry.js';
import { MovieSnapshotSchema } from './movie.js';

/** O que o quiz e a retrospectiva leem de cada entrada da lista. */
export type QuizEntryFields = Pick<Entry, 'tmdbId' | 'rankKey' | 'watchedOn' | 'comment' | 'movie'>;

/** lists/{listId}/entries/{entryId}, só os campos que o quiz e a retrospectiva usam, validados ao ler. */
export const QuizEntryFieldsSchema: z.ZodType<QuizEntryFields> = z.object({
  tmdbId: z.number().int().positive(),
  rankKey: z.string(),
  watchedOn: z.string().nullable(),
  comment: z.string(),
  movie: MovieSnapshotSchema,
});

/** Resposta do Gemini para o trecho: posições de início e fim no comentário enviado. */
export const ExcerptPositionsSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});

/** Resposta do Gemini para o enredo em emojis. */
export const PlotEmojiSchema = z.object({ emoji: z.string() });

/** Resposta do Gemini para a sinopse reescrita sem nomes próprios. */
export const NamelessSynopsisSchema = z.object({ synopsis: z.string() });

/** Resposta do Gemini para o parágrafo da retrospectiva do mês. */
export const RetroTextSchema = z.object({ text: z.string() });

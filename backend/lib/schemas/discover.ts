import * as z from 'zod';
import type {
  Dec,
  DiscoverItem,
  DiscoverPage,
  Dur,
  Filters,
  InterpretResult,
  Mood,
  MovieCompat,
  Theme,
} from '../types/discover.js';

/** Humores aceitos. */
export const MOODS = ['leve', 'tenso', 'ruim-divertido', 'chorar', 'cult'] as const satisfies readonly Mood[];

/** Faixas de duração aceitas. */
export const DURS = ['ate90', '90a120', 'mais120'] as const satisfies readonly Dur[];

/** Décadas aceitas. */
export const DECS = ['antes70', '1970', '1980', '1990', '2000', '2010', '2020'] as const satisfies readonly Dec[];

/** Temas aceitos. */
export const THEMES = [
  'lgbt',
  'fatos',
  'trash',
  'tempo',
  'golpes',
  'espaco',
  'zumbis-vampiros',
  'halloween',
  'serial-killer',
  'livro',
] as const satisfies readonly Theme[];

/** Humor. */
export const MoodSchema: z.ZodType<Mood> = z.enum(MOODS);

/** Faixa de duração. */
export const DurSchema: z.ZodType<Dur> = z.enum(DURS);

/** Década. */
export const DecSchema: z.ZodType<Dec> = z.enum(DECS);

/** Tema. */
export const ThemeSchema: z.ZodType<Theme> = z.enum(THEMES);

/** Filtros da busca avançada (também o formato pedido ao Gemini na interpretação). */
export const FiltersSchema: z.ZodType<Filters> = z.object({
  mood: z.array(MoodSchema).optional(),
  dur: z.array(DurSchema).optional(),
  dec: z.array(DecSchema).optional(),
  genre: z.array(z.string()).optional(),
  theme: z.array(ThemeSchema).optional(),
  svc: z.array(z.string()).optional(),
  fit: z.boolean().optional(),
});

/** Um resultado da busca avançada. */
export const DiscoverItemSchema: z.ZodType<DiscoverItem> = z.object({
  tmdbId: z.number().int().positive(),
  title: z.string(),
  year: z.number().int().nullable(),
  posterPath: z.string().nullable(),
  runtime: z.number().nullable(),
  genres: z.array(z.string()),
  providers: z.array(z.string()),
  score: z.number().min(0).max(100),
  reason: z.string(),
  trending: z.boolean(),
  inListEntryId: z.string().nullable(),
});

/** Saída de GET /api/discover. */
export const DiscoverPageSchema: z.ZodType<DiscoverPage> = z.object({
  results: z.array(DiscoverItemSchema),
  page: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

/** Saída de POST /api/search/interpret. */
export const InterpretResultSchema: z.ZodType<InterpretResult> = z.object({
  filters: FiltersSchema,
  explanation: z.string(),
});

/** Compatibilidade de um filme com a lista. */
export const MovieCompatSchema: z.ZodType<MovieCompat> = z.object({
  score: z.number().min(0).max(100),
  reason: z.string(),
});

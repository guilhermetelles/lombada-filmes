import * as z from 'zod';
import type {
  Dec,
  DiscoverItem,
  DiscoverPage,
  Dur,
  Filters,
  InterpretedFilters,
  InterpretReply,
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

/** Campos dos filtros que a interpretação do texto pode preencher. */
const interpretedFilterFields = {
  mood: z.array(MoodSchema).optional(),
  dur: z.array(DurSchema).optional(),
  dec: z.array(DecSchema).optional(),
  genre: z.array(z.string()).optional(),
  theme: z.array(ThemeSchema).optional(),
  svc: z.array(z.string()).optional(),
  fit: z.boolean().optional(),
};

/** Filtros da busca avançada. */
export const FiltersSchema: z.ZodType<Filters> = z.object({
  ...interpretedFilterFields,
  kw: z.array(z.number().int().positive()).max(5).optional(),
});

/**
 * Filtros no formato pedido ao modelo na interpretação: sem `kw`, cujos ids vêm do TMDb a partir dos
 * termos (o Qwen chegou a preencher `kw` com 0, e a resposta caía fora do formato).
 */
export const InterpretedFiltersSchema: z.ZodType<InterpretedFilters> = z.object(interpretedFilterFields);

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
  matchedKeywords: z.array(z.number().int()),
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
  keywords: z.array(z.object({ id: z.number().int().positive(), label: z.string() })),
});

/** Resposta do modelo na interpretação do texto livre. */
export const InterpretReplySchema: z.ZodType<InterpretReply> = z.object({
  filters: InterpretedFiltersSchema,
  explanation: z.string(),
  keywords: z
    .array(z.object({ term: z.string(), label: z.string() }))
    .max(5)
    .default([]),
});

/** Compatibilidade de um filme com a lista. */
export const MovieCompatSchema: z.ZodType<MovieCompat> = z.object({
  score: z.number().min(0).max(100),
  reason: z.string(),
});

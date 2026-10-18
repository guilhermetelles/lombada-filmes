/** Busca avançada, texto livre interpretado e compatibilidade de um filme com a lista. */

/** Humor. */
export type Mood = 'leve' | 'tenso' | 'ruim-divertido' | 'chorar' | 'cult';

/** Faixa de duração. */
export type Dur = 'ate90' | '90a120' | 'mais120';

/** Década. */
export type Dec = 'antes70' | '1970' | '1980' | '1990' | '2000' | '2010' | '2020';

/** Tema. */
export type Theme =
  | 'lgbt'
  | 'fatos'
  | 'trash'
  | 'tempo'
  | 'golpes'
  | 'espaco'
  | 'zumbis-vampiros'
  | 'halloween'
  | 'serial-killer'
  | 'livro';

/** Filtros da busca avançada. */
export type Filters = {
  mood?: Mood[] | undefined;
  dur?: Dur[] | undefined;
  dec?: Dec[] | undefined;
  genre?: string[] | undefined;
  theme?: Theme[] | undefined;
  svc?: string[] | undefined; // serviços de streaming
  fit?: boolean | undefined; // só o que combina com a lista
};

/** Um resultado da busca avançada. */
export type DiscoverItem = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  runtime: number | null;
  genres: string[];
  providers: string[];
  score: number; // compatibilidade de 0 a 100
  reason: string;
  trending: boolean;
  inListEntryId: string | null; // entrada da lista, quando o filme já está nela
};

/** Saída de GET /api/discover. */
export type DiscoverPage = {
  results: DiscoverItem[];
  page: number;
  totalPages: number;
};

/** Saída de POST /api/search/interpret. */
export type InterpretResult = {
  filters: Filters;
  explanation: string;
};

/** Compatibilidade de um filme com a lista, em GET /api/movies/{tmdbId}?listId=. */
export type MovieCompat = {
  score: number;
  reason: string;
};

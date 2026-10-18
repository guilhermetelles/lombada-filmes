/** Sugestões de uma lista: lists/{listId}/recs/current, gravado pela rotina recs. */

/** De onde veio a sugestão. */
export type RecSource = 'model' | 'trending' | 'nowPlaying';

/** Agrupamento da sugestão na tela. */
export type RecKind = 'saga' | 'diretor' | 'tema' | 'emAlta';

/** Um filme sugerido, já com o que a tela mostra. */
export type RecItem = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  runtime: number | null;
  genres: string[];
  providers: string[];
  score: number; // compatibilidade de 0 a 100
  reason: string; // frase curta (Gemini a partir dos comentários; reserva pelas variáveis)
  reasonFrom: string[]; // movieIds/entryIds da lista que justificam
  source: RecSource;
  kind: RecKind;
};

/** Modelo de compatibilidade ajustado para a lista (regressão logística). */
export type RecsModel = {
  bias: number;
  weights: Record<string, number>; // até 300 variáveis
};

/** Documento lists/{listId}/recs/current. */
export type RecsDoc = {
  computedAt: Date;
  modelVersion: string;
  model: RecsModel;
  items: RecItem[]; // até 30, da maior compatibilidade para a menor
  trending: RecItem[]; // até 15, em alta e em cartaz no Brasil, fora da lista
};

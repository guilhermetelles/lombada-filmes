/** Sugestões de uma lista: lists/{listId}/recs/current, gravado pela rotina recs. */

/** De onde veio a sugestão. */
export type RecSource = 'model' | 'trending' | 'nowPlaying';

/** Agrupamento da sugestão na tela. */
export type RecKind = 'saga' | 'diretor' | 'tema' | 'emAlta';

/** Um filme sugerido, já com o que a tela mostra. */
export type RecItem = {
  tmdbId: number;
  title: string; // em português (título no Brasil, quando há)
  titleEn?: string | undefined; // em inglês: movies/{id}.title; sem documento, o original quando é inglês
  year: number | null;
  posterPath: string | null;
  runtime: number | null;
  genres: string[];
  providers: string[];
  score: number; // compatibilidade de 0 a 100
  reason: string; // frase curta (Gemini a partir dos comentários; reserva pelas variáveis)
  reasonFrom: string[]; // movieIds/entryIds da lista que justificam
  reasonBy?: 'gemini' | 'rules' | undefined; // quem escreveu o motivo (ausente nos documentos antigos)
  source: RecSource;
  kind: RecKind;
};

/** Modelo de compatibilidade ajustado para a lista (regressão logística). */
export type RecsModel = {
  bias: number;
  weights: Record<string, number>; // até 300 variáveis
  labels?: Record<string, string> | undefined; // rótulo em português de cada palavra-chave (nome em inglês)
};

/** Documento lists/{listId}/recs/current. */
export type RecsDoc = {
  computedAt: Date;
  modelVersion: string;
  model: RecsModel;
  items: RecItem[]; // até 30, só os filmes da vez na rotação; os 10 primeiros com variedade
  trending: RecItem[]; // até 15, em alta e em cartaz no Brasil, fora da lista; os 5 primeiros da vez
  scores?: Record<string, RecScore> | undefined; // os outros candidatos pontuados, por tmdbId (página do filme)
};

/** Nota e motivo de um candidato que ficou fora de items e trending (fora da vez na rotação). */
export type RecScore = { score: number; reason: string };

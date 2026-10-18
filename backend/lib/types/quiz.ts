/** Quiz diário: perguntas, respostas, gabarito e placar mensal da lista. */

/** Tipo de pergunta. */
export type QuizType =
  | 'diretor'
  | 'ano'
  | 'trecho'
  | 'poster'
  | 'ranking'
  | 'mes'
  | 'personagem'
  | 'emoji'
  | 'sinopse'
  | 'bechdel'
  | 'bilheteria'
  | 'premio';

/** Id de uma alternativa. */
export type QuizOptionId = 'a' | 'b' | 'c' | 'd';

/** Uma alternativa. */
export type QuizOption = {
  id: QuizOptionId;
  label: string;
  imageUrl?: string | null | undefined;
};

/** Recorte do pôster que o app aplica na pergunta de pôster. */
export type PosterCrop = {
  x: number;
  y: number;
  zoom: number;
};

/** O que a pergunta mostra além do enunciado. */
export type QuizMedia = {
  posterPath?: string | undefined;
  crop?: PosterCrop | undefined;
  excerpt?: string | undefined; // trecho verbatim de um comentário, título trocado por ▇▇▇
  emoji?: string | undefined; // Gemini
  synopsis?: string | undefined; // Gemini: sinopse sem nomes
};

/** Documento lists/{listId}/quizzes/{dia}: a pergunta pública do dia. */
export type QuizDoc = {
  day: string; // AAAA-MM-DD
  type: QuizType;
  prompt: string;
  options: QuizOption[];
  media?: QuizMedia | undefined;
  createdAt: Date;
};

/** Documento lists/{listId}/quizKeys/{dia}: gabarito, que ninguém lê pelo app. */
export type QuizKey = {
  rightOptionId: QuizOptionId;
  explanation: string;
};

/** Documento lists/{listId}/quizzes/{dia}/answers/{uid}. */
export type QuizAnswer = {
  optionId: QuizOptionId;
  correct: boolean;
  answeredAt: Date;
};

/** Resposta de outro membro, como a rota de resposta devolve. */
export type OtherAnswer = {
  uid: string;
  correct: boolean;
  optionId: QuizOptionId;
};

/** Saída de POST /api/lists/{listId}/quiz/{dia}/answer. */
export type QuizAnswerResult = {
  correct: boolean;
  rightOptionId: QuizOptionId;
  explanation: string;
  others: OtherAnswer[];
};

/** Documento lists/{listId}/scores/{mês}: pontos do mês e quem venceu (empate: todos). */
export type Scores = {
  points: Record<string, number>;
  winnerUids?: string[] | undefined;
};

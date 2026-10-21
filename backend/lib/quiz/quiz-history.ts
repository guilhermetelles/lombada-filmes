import type { Firestore } from 'firebase-admin/firestore';
import { QuizDocSchema, QuizKeySchema } from '../schemas/quiz.js';
import { DAY_MS } from '../time/durations.js';
import type { QuizDoc, QuizType } from '../types/quiz.js';
import type { RankedEntry } from './list-material.js';
import { quizKeysCollection, quizzesCollection } from './quiz-repository.js';

/** Por quantos dias o filme de uma pergunta fica fora das perguntas seguintes. */
export const MOVIE_COOLDOWN_DAYS = 30;

/**
 * Tipos cujo enunciado é sempre o mesmo e sem mídia: a pergunta só se distingue pelas alternativas.
 * Nos outros, enunciado e mídia já dizem de qual filme é a pergunta.
 */
const SAME_PROMPT_TYPES: ReadonlySet<QuizType> = new Set(['ranking', 'bilheteria', 'premio']);

/** O que já saiu na lista: perguntas que não podem repetir e filmes que descansam. */
export type QuizHistory = {
  usedKeys: ReadonlySet<string>; // quizKey de todas as perguntas já feitas, do dia e do evento
  recentMovieIds: ReadonlySet<number>; // filmes das perguntas dos últimos MOVIE_COOLDOWN_DAYS dias
};

/** Histórico vazio, de lista sem perguntas. */
export const EMPTY_QUIZ_HISTORY: QuizHistory = { usedKeys: new Set(), recentMovieIds: new Set() };

/**
 * Chave de repetição de uma pergunta: tipo, enunciado e mídia; nos tipos de enunciado fixo, também
 * as alternativas, em qualquer ordem. "Quem dirigiu X?" é a mesma pergunta com outras alternativas
 * erradas; "Qual destes custou mais?" com outros quatro filmes não é.
 *
 * @param quiz - Tipo, enunciado, mídia e alternativas.
 * @returns A chave.
 */
export function quizKey(quiz: Pick<QuizDoc, 'type' | 'prompt' | 'media' | 'options'>): string {
  const options = SAME_PROMPT_TYPES.has(quiz.type) ? quiz.options.map((option) => option.label).sort() : [];
  return JSON.stringify([quiz.type, quiz.prompt, quiz.media ?? null, options]);
}

/**
 * Lê o histórico de perguntas da lista: a chave de todas e o filme das criadas nos últimos
 * MOVIE_COOLDOWN_DAYS dias (gravado em quizKeys; as perguntas antigas não têm). Documento fora do
 * formato fica de fora.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param now - Momento da rotina.
 * @returns O histórico.
 */
export async function readQuizHistory(db: Firestore, listId: string, now: Date): Promise<QuizHistory> {
  const [quizzes, keys] = await Promise.all([
    quizzesCollection(db, listId).get(),
    quizKeysCollection(db, listId).get(),
  ]);
  const since = now.getTime() - MOVIE_COOLDOWN_DAYS * DAY_MS;
  const usedKeys = new Set<string>();
  const recentIds = new Set<string>();
  for (const doc of quizzes.docs) {
    const quiz = QuizDocSchema.safeParse(doc.data());
    if (!quiz.success) continue;
    usedKeys.add(quizKey(quiz.data));
    if (quiz.data.createdAt.getTime() >= since) recentIds.add(doc.id);
  }

  const recentMovieIds = new Set<number>();
  for (const doc of keys.docs) {
    const tmdbId = recentIds.has(doc.id) ? QuizKeySchema.safeParse(doc.data()).data?.tmdbId : undefined;
    if (tmdbId !== undefined) recentMovieIds.add(tmdbId);
  }
  return { usedKeys, recentMovieIds };
}

/**
 * Tira das candidatas os filmes que estão descansando, para o gerador sortear o filme da pergunta.
 *
 * @param entries - Entradas candidatas.
 * @param recentMovieIds - Filmes das perguntas recentes.
 * @returns As entradas cujo filme pode ser a resposta hoje.
 */
export function restedEntries(
  entries: readonly RankedEntry[],
  recentMovieIds: ReadonlySet<number> = new Set(),
): RankedEntry[] {
  return entries.filter((entry) => !recentMovieIds.has(entry.tmdbId));
}

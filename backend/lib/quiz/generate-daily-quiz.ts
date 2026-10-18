import type { QuizType } from '../types/quiz.js';
import type { GeminiClient } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import type { GeneratedQuiz, QuizGenerator } from './build-question.js';
import { generateAwardQuiz } from './generators/award.js';
import { generateBechdelQuiz } from './generators/bechdel.js';
import { generateBudgetQuiz } from './generators/budget.js';
import { generateCharacterQuiz } from './generators/character.js';
import { generateDirectorQuiz } from './generators/director.js';
import { generateEmojiQuiz } from './generators/emoji.js';
import { generateExcerptQuiz } from './generators/excerpt.js';
import { generateMonthQuiz } from './generators/month.js';
import { generatePosterQuiz } from './generators/poster.js';
import { generateRankingQuiz } from './generators/ranking.js';
import { generateSynopsisQuiz } from './generators/synopsis.js';
import { generateYearQuiz } from './generators/year.js';
import type { ListMaterial } from './list-material.js';
import { createSeededRandom, shuffle } from './seeded-random.js';

/** O gerador de cada tipo de pergunta. */
export const QUIZ_GENERATORS: Record<QuizType, QuizGenerator> = {
  diretor: generateDirectorQuiz,
  ano: generateYearQuiz,
  trecho: generateExcerptQuiz,
  poster: generatePosterQuiz,
  ranking: generateRankingQuiz,
  mes: generateMonthQuiz,
  personagem: generateCharacterQuiz,
  emoji: generateEmojiQuiz,
  sinopse: generateSynopsisQuiz,
  bechdel: generateBechdelQuiz,
  bilheteria: generateBudgetQuiz,
  premio: generateAwardQuiz,
};

/** O que a escolha da pergunta do dia recebe. */
type DailyQuizRequest = {
  material: ListMaterial;
  day: string; // AAAA-MM-DD de Brasília
  gemini: GeminiClient;
  usage: UsageRecorder;
  recentTypes?: readonly QuizType[]; // tipos dos últimos dias, que vão para o fim da fila
};

/**
 * Sorteia o tipo da pergunta do dia entre os que têm dados na lista: embaralha os 12 tipos com a
 * semente do dia e da lista, põe no fim os tipos usados nos últimos dias e devolve a primeira
 * pergunta que um gerador conseguir montar. Cada tipo tem a própria semente, para o resultado de um
 * não depender de quantos números o anterior sorteou.
 *
 * @param request - Material da lista, dia, Gemini, medidor de consumo e tipos recentes.
 * @returns A pergunta, ou undefined se nenhum tipo tiver dados.
 */
async function generateDailyQuiz({
  material,
  day,
  gemini,
  usage,
  recentTypes = [],
}: DailyQuizRequest): Promise<GeneratedQuiz | undefined> {
  const seed = `${day}|${material.listId}`;
  const shuffled = shuffle(Object.keys(QUIZ_GENERATORS) as QuizType[], createSeededRandom(seed));
  const order = [
    ...shuffled.filter((type) => !recentTypes.includes(type)),
    ...shuffled.filter((type) => recentTypes.includes(type)),
  ];

  for (const type of order) {
    const random = createSeededRandom(`${seed}|${type}`);
    const quiz = await QUIZ_GENERATORS[type]({ material, random, day, gemini, usage });
    if (quiz) return quiz;
  }
  return undefined;
}

export { generateDailyQuiz };

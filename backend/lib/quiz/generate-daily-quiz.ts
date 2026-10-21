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
import { EMPTY_QUIZ_HISTORY, type QuizHistory, quizKey } from './quiz-history.js';
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

/** Quantos sorteios cada tipo tem para achar uma pergunta inédita com um filme que não descansa. */
const DRAWS_PER_TYPE = 3;

/** O que a escolha da pergunta do dia recebe. */
type DailyQuizRequest = {
  material: ListMaterial;
  day: string; // AAAA-MM-DD de Brasília
  gemini: GeminiClient;
  usage: UsageRecorder;
  recentTypes?: readonly QuizType[]; // tipos dos últimos dias, que vão para o fim da fila
  history?: QuizHistory; // perguntas já feitas e filmes que descansam
};

/**
 * Sorteia o tipo da pergunta do dia entre os que têm dados na lista: embaralha os 12 tipos com a
 * semente do dia e da lista, põe no fim os tipos usados nos últimos dias e devolve a primeira
 * pergunta que um gerador conseguir montar. Cada tipo tem a própria semente, para o resultado de um
 * não depender de quantos números o anterior sorteou. A pergunta nunca repete uma já feita (quizKey)
 * nem usa um filme que descansa: o gerador já evita esses filmes, e a pergunta que ainda assim cair
 * numa dessas é sorteada de novo, com outra semente, até DRAWS_PER_TYPE vezes.
 *
 * @param request - Material da lista, dia, Gemini, medidor de consumo, tipos recentes e histórico.
 * @returns A pergunta, ou undefined se nenhum tipo tiver dados.
 */
async function generateDailyQuiz({
  material,
  day,
  gemini,
  usage,
  recentTypes = [],
  history = EMPTY_QUIZ_HISTORY,
}: DailyQuizRequest): Promise<GeneratedQuiz | undefined> {
  const seed = `${day}|${material.listId}`;
  const shuffled = shuffle(Object.keys(QUIZ_GENERATORS) as QuizType[], createSeededRandom(seed));
  const order = [
    ...shuffled.filter((type) => !recentTypes.includes(type)),
    ...shuffled.filter((type) => recentTypes.includes(type)),
  ];

  const { usedKeys, recentMovieIds } = history;
  for (const type of order) {
    for (let draw = 1; draw <= DRAWS_PER_TYPE; draw++) {
      // O primeiro sorteio mantém a semente de antes; os seguintes ganham o número do sorteio.
      const random = createSeededRandom(draw === 1 ? `${seed}|${type}` : `${seed}|${type}|${draw}`);
      const quiz = await QUIZ_GENERATORS[type]({ material, random, day, gemini, usage, recentMovieIds });
      // Sem pergunta, o tipo não tem dados hoje (ou o Gemini falhou): outro sorteio não ajuda.
      if (!quiz) break;
      if (!usedKeys.has(quizKey(quiz)) && !recentMovieIds.has(quiz.tmdbId)) return quiz;
    }
  }
  return undefined;
}

export { generateDailyQuiz };

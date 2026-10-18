import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import type { RankedEntry } from '../list-material.js';
import { movieLabel } from '../quiz-text.js';
import { shuffle } from '../seeded-random.js';

/** As perguntas de ranking sorteiam entre os primeiros da lista, que vocês lembram melhor. */
const RANKING_POOL = 60;

/**
 * Pergunta "Qual destes está mais alto no ranking de vocês?": quatro filmes sorteados entre os 60
 * primeiros; certo é o de melhor posição.
 *
 * @param context - Material da lista e gerador com semente.
 * @returns A pergunta, ou undefined se a lista tiver menos de 4 filmes com rótulos diferentes.
 */
async function generateRankingQuiz({ material, random }: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const seen = new Set<string>();
  const picks: RankedEntry[] = [];
  for (const entry of shuffle(material.entries.slice(0, RANKING_POOL), random)) {
    if (picks.length === WRONG_OPTIONS + 1) break;
    if (seen.has(movieLabel(entry))) continue;
    seen.add(movieLabel(entry));
    picks.push(entry);
  }
  const [best, ...wrong] = [...picks].sort((a, b) => a.rank - b.rank);
  if (!best) return undefined;

  const ranking = [best, ...wrong].map((entry) => `#${entry.rank} ${entry.title}`).join(', ');
  return buildQuestion(
    {
      type: 'ranking',
      prompt: 'Qual destes está mais alto no ranking de vocês?',
      explanation: `No ranking: ${ranking}.`,
    },
    { label: movieLabel(best) },
    wrong.map((entry) => ({ label: movieLabel(entry) })),
    random,
  );
}

export { generateRankingQuiz };

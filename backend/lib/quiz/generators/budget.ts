import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import type { RankedEntry } from '../list-material.js';
import { formatMoney, movieLabel } from '../quiz-text.js';
import { shuffle } from '../seeded-random.js';

/** Quantos sorteios tentar até achar um grupo com um orçamento claramente maior. */
const ATTEMPTS = 20;

/** O maior orçamento precisa passar o segundo em 25% para a pergunta ter resposta clara. */
const CLEAR_MARGIN = 1.25;

/**
 * Orçamento de uma entrada (0 sem dado).
 *
 * @param entry - Entrada.
 * @returns O orçamento em US$.
 */
function budgetOf(entry: RankedEntry): number {
  return entry.movie?.budget ?? 0;
}

/**
 * Pergunta "Qual destes custou mais para fazer?": quatro filmes da lista com orçamento conhecido no
 * TMDb, sorteados até o maior passar o segundo com folga.
 *
 * @param context - Material da lista e gerador com semente.
 * @returns A pergunta, ou undefined sem 4 filmes com orçamento ou sem um maior que os outros.
 */
async function generateBudgetQuiz({ material, random }: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const seen = new Set<string>();
  const pool = material.entries.filter((entry) => {
    if (budgetOf(entry) <= 0 || seen.has(movieLabel(entry))) return false;
    seen.add(movieLabel(entry));
    return true;
  });
  if (pool.length <= WRONG_OPTIONS) return undefined;

  let picks: RankedEntry[] = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    picks = shuffle(pool, random)
      .slice(0, WRONG_OPTIONS + 1)
      .sort((a, b) => budgetOf(b) - budgetOf(a));
    const [first, second] = picks;
    if (first && second && budgetOf(first) >= budgetOf(second) * CLEAR_MARGIN) break;
  }
  const [best, ...wrong] = picks;
  const runnerUp = wrong[0];
  if (!best || !runnerUp || budgetOf(best) <= budgetOf(runnerUp)) return undefined;

  return buildQuestion(
    {
      type: 'bilheteria',
      prompt: 'Qual destes custou mais para fazer?',
      explanation: `Orçamentos: ${picks.map((entry) => `${entry.title} ${formatMoney(budgetOf(entry))}`).join(', ')}.`,
    },
    { label: movieLabel(best) },
    wrong.map((entry) => ({ label: movieLabel(entry) })),
    random,
  );
}

export { generateBudgetQuiz };

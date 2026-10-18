import type { QuizMedia, QuizOption, QuizOptionId, QuizType } from '../types/quiz.js';
import type { GeminiClient } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import type { ListMaterial } from './list-material.js';
import { type Random, shuffle } from './seeded-random.js';

/** Ids das quatro alternativas, na ordem em que aparecem. */
const OPTION_IDS: readonly QuizOptionId[] = ['a', 'b', 'c', 'd'];

/** Quantas alternativas erradas cada pergunta tem. */
export const WRONG_OPTIONS = 3;

/** Pergunta pronta: a parte pública (quizzes/{dia}) e o gabarito (quizKeys/{dia}). */
export type GeneratedQuiz = {
  type: QuizType;
  prompt: string;
  options: QuizOption[];
  media?: QuizMedia | undefined;
  rightOptionId: QuizOptionId;
  explanation: string;
};

/** O que cada gerador recebe. */
export type QuizGeneratorContext = {
  material: ListMaterial;
  random: Random; // com a semente do dia e do tipo
  day: string; // AAAA-MM-DD de Brasília
  gemini: GeminiClient;
  usage: UsageRecorder;
};

/** Gera uma pergunta de um tipo, ou devolve undefined quando a lista não tem dados para ela. */
export type QuizGenerator = (context: QuizGeneratorContext) => Promise<GeneratedQuiz | undefined>;

/** Uma alternativa antes de ganhar id. */
export type Choice = { label: string; imageUrl?: string | null | undefined };

/** Enunciado, mídia e explicação da pergunta. */
type QuestionBase = Pick<GeneratedQuiz, 'type' | 'prompt' | 'media' | 'explanation'>;

/**
 * Monta a pergunta com a alternativa certa e as três erradas, embaralhadas (ou na ordem dada) e com
 * ids a–d. Recusa alternativas repetidas ou em número errado.
 *
 * @param base - Tipo, enunciado, mídia e explicação.
 * @param right - Alternativa certa.
 * @param wrong - Alternativas erradas (precisam ser 3, todas diferentes da certa).
 * @param random - Gerador com semente; sem ele, a ordem fica certa primeiro e as erradas depois.
 * @returns A pergunta, ou undefined se faltarem alternativas ou houver repetidas.
 */
export function buildQuestion(
  base: QuestionBase,
  right: Choice,
  wrong: readonly Choice[],
  random?: Random,
): GeneratedQuiz | undefined {
  const all = [{ ...right, right: true }, ...wrong.map((choice) => ({ ...choice, right: false }))];
  return buildFromOrdered(base, random ? shuffle(all, random) : all);
}

/**
 * Monta a pergunta com as alternativas já na ordem final.
 *
 * @param base - Tipo, enunciado, mídia e explicação.
 * @param ordered - As quatro alternativas, uma delas marcada como certa.
 * @returns A pergunta, ou undefined se não houver exatamente 4 alternativas diferentes e 1 certa.
 */
export function buildFromOrdered(
  base: QuestionBase,
  ordered: readonly (Choice & { right: boolean })[],
): GeneratedQuiz | undefined {
  if (ordered.length !== WRONG_OPTIONS + 1) return undefined;
  if (new Set(ordered.map((choice) => choice.label)).size !== ordered.length) return undefined;
  if (ordered.filter((choice) => choice.right).length !== 1) return undefined;

  const options = ordered.map(
    (choice, index): QuizOption => ({
      id: OPTION_IDS[index] ?? 'a',
      label: choice.label,
      ...(choice.imageUrl !== undefined && { imageUrl: choice.imageUrl }),
    }),
  );
  const rightIndex = ordered.findIndex((choice) => choice.right);
  return { ...base, options, rightOptionId: OPTION_IDS[rightIndex] ?? 'a' };
}

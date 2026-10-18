import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import { joinPt } from '../quiz-text.js';
import { pick, shuffle } from '../seeded-random.js';

/** Distâncias possíveis entre o ano certo e os errados. */
const YEAR_OFFSETS = [-4, -3, -2, -1, 1, 2, 3, 4];

/**
 * Pergunta "Em que ano … foi lançado?": as alternativas erradas ficam a até 4 anos do certo, nunca
 * depois do ano corrente.
 *
 * @param context - Material da lista, gerador com semente e o dia.
 * @returns A pergunta, ou undefined se nenhum filme tiver ano.
 */
async function generateYearQuiz({ material, random, day }: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const target = pick(
    material.entries.filter((entry) => entry.year !== null),
    random,
  );
  const year = target?.year;
  if (!target || !year) return undefined;

  const currentYear = Number(day.slice(0, 4));
  const offsets = shuffle(
    YEAR_OFFSETS.filter((offset) => year + offset <= currentYear),
    random,
  ).slice(0, WRONG_OPTIONS);
  const directors = target.movie?.directors.map((director) => director.name) ?? [];
  const directedBy = directors.length > 0 ? ` Direção de ${joinPt(directors)}.` : '';

  return buildQuestion(
    {
      type: 'ano',
      prompt: `Em que ano ${target.title} foi lançado?`,
      explanation: `${target.title} é de ${year}.${directedBy}`,
    },
    { label: String(year) },
    offsets.map((offset) => ({ label: String(year + offset) })),
    random,
  );
}

export { generateYearQuiz };

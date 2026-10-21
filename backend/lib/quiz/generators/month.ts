import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import { restedEntries } from '../quiz-history.js';
import { addMonths, formatDay, monthLabel, movieLabel } from '../quiz-text.js';
import { pick, shuffle } from '../seeded-random.js';

/** Distâncias possíveis, em meses, entre o mês certo e os errados. */
const MONTH_OFFSETS = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6];

/**
 * Pergunta "Em que mês vocês viram …?": as alternativas erradas ficam a até 6 meses do certo,
 * nunca depois do mês corrente.
 *
 * @param context - Material da lista, gerador com semente e o dia.
 * @returns A pergunta, ou undefined se nenhuma entrada tiver data.
 */
async function generateMonthQuiz({
  material,
  random,
  day,
  recentMovieIds,
}: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const target = pick(
    restedEntries(material.entries, recentMovieIds).filter((entry) => entry.watchedOn),
    random,
  );
  const watchedOn = target?.watchedOn;
  if (!target || !watchedOn) return undefined;

  const month = watchedOn.slice(0, 7);
  const currentMonth = day.slice(0, 7);
  const wrong = shuffle(
    MONTH_OFFSETS.map((offset) => addMonths(month, offset)).filter((other) => other <= currentMonth),
    random,
  ).slice(0, WRONG_OPTIONS);

  return buildQuestion(
    {
      type: 'mes',
      prompt: `Em que mês vocês viram ${movieLabel(target)}?`,
      explanation: `Vocês viram ${target.title} em ${formatDay(watchedOn)}, segundo o registro da lista.`,
      tmdbId: target.tmdbId,
    },
    { label: monthLabel(month) },
    wrong.map((other) => ({ label: monthLabel(other) })),
    random,
  );
}

export { generateMonthQuiz };

import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import { restedEntries } from '../quiz-history.js';
import { joinPt, movieLabel } from '../quiz-text.js';
import { pick, shuffle } from '../seeded-random.js';

/** Quantos diretores de anos próximos entram no sorteio das alternativas erradas. */
const NEAREST_DIRECTORS = 8;

/**
 * Pergunta "Quem dirigiu …?": as alternativas erradas são diretores de outros filmes da lista,
 * sorteados entre os de anos mais próximos (mais plausíveis).
 *
 * @param context - Material da lista e gerador com semente.
 * @returns A pergunta, ou undefined se a lista não tiver 4 diretores diferentes.
 */
async function generateDirectorQuiz({
  material,
  random,
  recentMovieIds,
}: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const directed = material.entries.filter((entry) => (entry.movie?.directors.length ?? 0) > 0);
  const target = pick(restedEntries(directed, recentMovieIds), random);
  const directors = target?.movie?.directors ?? [];
  const main = directors[0];
  if (!target || !main) return undefined;

  const ownNames = new Set(directors.map((director) => director.name));
  const yearByName = new Map<string, number | null>();
  for (const entry of directed) {
    const name = entry.movie?.directors[0]?.name;
    if (name && !ownNames.has(name) && !yearByName.has(name)) yearByName.set(name, entry.year);
  }
  const distance = (year: number | null) => (year && target.year ? Math.abs(year - target.year) : 1000);
  const nearest = [...yearByName.entries()]
    .sort((a, b) => distance(a[1]) - distance(b[1]))
    .slice(0, NEAREST_DIRECTORS)
    .map(([name]) => name);
  const wrong = shuffle(nearest, random).slice(0, WRONG_OPTIONS);

  return buildQuestion(
    {
      type: 'diretor',
      prompt: `Quem dirigiu ${movieLabel(target)}?`,
      explanation: `${movieLabel(target)} tem direção de ${joinPt(directors.map((director) => director.name))}.`,
      tmdbId: target.tmdbId,
    },
    { label: main.name },
    wrong.map((label) => ({ label })),
    random,
  );
}

export { generateDirectorQuiz };

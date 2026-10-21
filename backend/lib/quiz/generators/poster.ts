import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import { otherEntries } from '../other-entries.js';
import { restedEntries } from '../quiz-history.js';
import { movieLabel } from '../quiz-text.js';
import { pick } from '../seeded-random.js';

/** Quanto o app amplia o pôster no recorte. */
const CROP_ZOOM = 3;

/**
 * Sorteia o centro do recorte como fração da largura e da altura (0 a 1), longe das bordas e da
 * parte de baixo, onde costumam ficar os créditos.
 *
 * @param random - Gerador com semente.
 * @returns Centro do recorte e ampliação.
 */
function cropCenter(random: () => number) {
  const round = (value: number) => Math.round(value * 100) / 100;
  return { x: round(0.15 + random() * 0.7), y: round(0.15 + random() * 0.45), zoom: CROP_ZOOM };
}

/**
 * Pergunta "De qual filme é este pedaço do pôster?": o app mostra o pôster (`media.posterPath`)
 * ampliado em `media.crop`, com `x` e `y` como fração da largura e da altura (0 a 1) do ponto
 * central do recorte e `zoom` como ampliação. Segredo cosmético: o caminho do pôster é público.
 *
 * @param context - Material da lista e gerador com semente.
 * @returns A pergunta, ou undefined se não houver 4 filmes com pôster.
 */
async function generatePosterQuiz({
  material,
  random,
  recentMovieIds,
}: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const target = pick(
    restedEntries(material.entries, recentMovieIds).filter((entry) => entry.posterPath),
    random,
  );
  if (!target?.posterPath) return undefined;

  const others = otherEntries(material.entries, target, WRONG_OPTIONS, random);
  return buildQuestion(
    {
      type: 'poster',
      prompt: 'De qual filme é este pedaço do pôster?',
      media: { posterPath: target.posterPath, crop: cropCenter(random) },
      explanation: `É o pôster de ${movieLabel(target)}.`,
      tmdbId: target.tmdbId,
    },
    { label: movieLabel(target) },
    others.map((entry) => ({ label: movieLabel(entry) })),
    random,
  );
}

export { generatePosterQuiz };

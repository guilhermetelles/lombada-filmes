import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import type { RankedEntry } from '../list-material.js';
import { joinPt, movieLabel } from '../quiz-text.js';
import { pick, shuffle } from '../seeded-random.js';

/** As duas premiações da pergunta. */
type Org = 'Oscar' | 'Framboesa de Ouro';

/** Quantas categorias a explicação cita. */
const CATEGORIES_SHOWN = 3;

/**
 * Diz se o filme ganhou o prêmio.
 *
 * @param entry - Entrada.
 * @param org - Premiação.
 * @returns true com ao menos uma vitória.
 */
function won(entry: RankedEntry, org: Org): boolean {
  return (entry.movie?.awards?.items ?? []).some((item) => item.org === org && item.kind === 'win');
}

/**
 * Diz se já se sabe que o filme não tem nem indicação ao prêmio: os prêmios foram buscados e nenhum
 * é dessa premiação.
 *
 * @param entry - Entrada.
 * @param org - Premiação.
 * @returns true quando os prêmios foram buscados e não há vitória nem indicação.
 */
function knownWithout(entry: RankedEntry, org: Org): boolean {
  const awards = entry.movie?.awards;
  return awards !== undefined && !awards.items.some((item) => item.org === org);
}

/**
 * Pergunta "Qual destes ganhou um Oscar?" (ou uma Framboesa de Ouro): um vencedor da lista e três
 * filmes que sabidamente não têm nem indicação, de anos já premiados. A premiação é sorteada; sem
 * vencedor dela na lista, vale a outra.
 *
 * @param context - Material da lista, gerador com semente e o dia.
 * @returns A pergunta, ou undefined se faltarem vencedor ou três filmes sem indicação.
 */
async function generateAwardQuiz({ material, random, day }: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const lastAwardedYear = Number(day.slice(0, 4)) - 1;
  const orgs: Org[] = random() < 0.5 ? ['Framboesa de Ouro', 'Oscar'] : ['Oscar', 'Framboesa de Ouro'];

  for (const org of orgs) {
    const target = pick(
      material.entries.filter((entry) => won(entry, org)),
      random,
    );
    if (!target) continue;
    const seen = new Set([movieLabel(target)]);
    const wrong = shuffle(
      material.entries.filter(
        (entry) => entry.year !== null && entry.year <= lastAwardedYear && knownWithout(entry, org),
      ),
      random,
    )
      .filter((entry) => !seen.has(movieLabel(entry)) && seen.add(movieLabel(entry)))
      .slice(0, WRONG_OPTIONS);
    if (wrong.length < WRONG_OPTIONS) continue;

    const categories = [
      ...new Set(
        (target.movie?.awards?.items ?? []).flatMap((item) =>
          item.org === org && item.kind === 'win' && item.cat ? [item.cat] : [],
        ),
      ),
    ].slice(0, CATEGORIES_SHOWN);
    const what =
      org === 'Oscar'
        ? `ganhou o Oscar${categories.length > 0 ? ` (${joinPt(categories)})` : ''}`
        : `ganhou a Framboesa de Ouro, o prêmio dos piores do ano${categories.length > 0 ? ` (${joinPt(categories)})` : ''}`;

    return buildQuestion(
      {
        type: 'premio',
        prompt: `Qual destes ganhou ${org === 'Oscar' ? 'um Oscar' : 'uma Framboesa de Ouro'}?`,
        explanation: `${movieLabel(target)} ${what}. Os outros três não têm nem indicação.`,
      },
      { label: movieLabel(target) },
      wrong.map((entry) => ({ label: movieLabel(entry) })),
      random,
    );
  }
  return undefined;
}

export { generateAwardQuiz };

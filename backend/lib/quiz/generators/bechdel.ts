import { buildFromOrdered, type GeneratedQuiz, type QuizGeneratorContext } from '../build-question.js';
import { movieLabel } from '../quiz-text.js';
import { pick } from '../seeded-random.js';

/** Rótulo de cada nota do Teste de Bechdel (índice = critérios cumpridos). */
const RATING_LABELS = ['Nenhum', '1 de 3', '2 de 3', 'Passa nos 3 critérios'];

/** Os três critérios do teste, na ordem do bechdeltest.com. */
const CRITERIA = [
  'Tem pelo menos duas mulheres com nome',
  'Elas conversam entre si',
  'Sobre algo que não seja um homem',
];

/**
 * Pergunta "… passa no Teste de Bechdel?": as quatro notas possíveis, sempre na mesma ordem (de 3
 * critérios a nenhum); a explicação lista os critérios cumpridos segundo o bechdeltest.com.
 *
 * @param context - Material da lista e gerador com semente.
 * @returns A pergunta, ou undefined se nenhum filme da lista estiver no bechdeltest.com.
 */
async function generateBechdelQuiz({ material, random }: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const target = pick(
    material.entries.filter((entry) => typeof entry.movie?.bechdel?.rating === 'number'),
    random,
  );
  const bechdel = target?.movie?.bechdel;
  const rating = bechdel?.rating;
  if (!target || !bechdel || typeof rating !== 'number') return undefined;

  const criteria = CRITERIA.map((criterion, index) => `${index < rating ? '✓' : '✗'} ${criterion}`).join('\n');
  const dubious = bechdel.dubious ? ' (avaliação marcada como duvidosa no site)' : '';
  return buildFromOrdered(
    {
      type: 'bechdel',
      prompt: `${movieLabel(target)} passa no Teste de Bechdel?`,
      explanation: `Segundo o bechdeltest.com, ${target.title} cumpre ${rating} de 3 critérios${dubious}:\n${criteria}`,
    },
    [3, 2, 1, 0].map((value) => ({ label: RATING_LABELS[value] ?? String(value), right: value === rating })),
  );
}

export { generateBechdelQuiz };

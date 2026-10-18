import { logger } from '../../logging/logger.js';
import { PlotEmojiSchema } from '../../schemas/quiz-material.js';
import { GEMINI_MODELS } from '../../sources/gemini/gemini-models.js';
import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import { otherEntries } from '../other-entries.js';
import { movieLabel } from '../quiz-text.js';
import { pick } from '../seeded-random.js';

/** Instrução de sistema: o enredo só em emojis, a partir da sinopse. */
const SYSTEM_INSTRUCTION = `Você conta o enredo de um filme só com emojis, a partir da sinopse recebida.
Use de 3 a 6 emojis, na ordem da história, sem letras, números, palavras nem bandeiras.
Use só o que está na sinopse. Responda no campo emoji apenas os emojis, sem espaços.`;

/** Tamanho máximo da resposta, em unidades de texto (emojis compostos ocupam várias). */
const MAX_EMOJI_LENGTH = 60;

/**
 * Confere que a resposta tem só emojis: pelo menos um pictograma e nenhuma letra ou número.
 *
 * @param text - Resposta do Gemini, sem espaços nas pontas.
 * @returns true se servir.
 */
function isOnlyEmoji(text: string): boolean {
  return (
    text.length > 0 &&
    text.length <= MAX_EMOJI_LENGTH &&
    /\p{Extended_Pictographic}/u.test(text) &&
    !/[\p{L}\p{N}\s]/u.test(text)
  );
}

/**
 * Pergunta "Qual filme é este enredo em emojis?": o Gemini resume em emojis a sinopse do TMDb de um
 * filme da lista. Sem Gemini (ou com resposta fora do formato), o tipo fica sem pergunta no dia.
 *
 * @param context - Material da lista, gerador com semente, Gemini e medidor de consumo.
 * @returns A pergunta, ou undefined sem sinopse, sem Gemini ou com resposta que não seja só emojis.
 */
async function generateEmojiQuiz({
  material,
  random,
  gemini,
  usage,
}: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const target = pick(
    material.entries.filter((entry) => entry.movie?.synopsis.pt || entry.movie?.synopsis.en),
    random,
  );
  const synopsis = target?.movie?.synopsis.pt ?? target?.movie?.synopsis.en;
  if (!target || !synopsis) return undefined;

  let emoji: string;
  try {
    const reply = await usage.track('gemini', () =>
      gemini.generateJson({
        model: GEMINI_MODELS.text,
        system: SYSTEM_INSTRUCTION,
        prompt: `Filme: ${movieLabel(target)}\nSinopse: ${synopsis}`,
        schema: PlotEmojiSchema,
      }),
    );
    emoji = reply.emoji.trim();
  } catch (error) {
    logger.warn('Gemini falhou nos emojis do quiz', { listId: material.listId, error });
    return undefined;
  }
  if (!isOnlyEmoji(emoji)) {
    logger.warn('emojis do Gemini fora do formato', { listId: material.listId });
    return undefined;
  }

  const others = otherEntries(material.entries, target, WRONG_OPTIONS, random);
  return buildQuestion(
    {
      type: 'emoji',
      prompt: 'Qual filme é este enredo em emojis?',
      media: { emoji },
      explanation: `Os emojis contam ${movieLabel(target)}: ${synopsis}`,
    },
    { label: movieLabel(target) },
    others.map((entry) => ({ label: movieLabel(entry) })),
    random,
  );
}

export { generateEmojiQuiz };

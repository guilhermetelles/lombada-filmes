import { logger } from '../../logging/logger.js';
import { ExcerptPositionsSchema } from '../../schemas/quiz-material.js';
import { GEMINI_MODELS } from '../../sources/gemini/gemini-models.js';
import { NAME_PLACEHOLDER, scrubNames } from '../../sources/gemini/scrub-names.js';
import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import type { RankedEntry } from '../list-material.js';
import { otherEntries } from '../other-entries.js';
import { EXCERPT_LIMITS, formatDay, maskTitleWords, movieLabel, pickSentenceExcerpt } from '../quiz-text.js';
import { shuffle } from '../seeded-random.js';

/** Instrução de sistema do pedido de trecho: só posições, nada reescrito. */
const SYSTEM_INSTRUCTION = `Você recebe um comentário que duas pessoas escreveram sobre um filme.
Escolha o trecho contínuo mais reconhecível para elas (uma opinião marcante, uma piada, um detalhe só delas),
com ${EXCERPT_LIMITS.min} a ${EXCERPT_LIMITS.max} caracteres, de preferência frases inteiras.
Evite trechos com o título do filme e trechos com "${NAME_PLACEHOLDER}".
Não reescreva nada: responda só com as posições do trecho no texto recebido, contando caracteres a partir de 0.
start é a posição do primeiro caractere do trecho; end é a posição logo depois do último.`;

/**
 * Pede ao Gemini as posições de um trecho reconhecível do comentário (sem os nomes dos membros) e
 * confere o resultado: o pedaço, ajustado para começar e terminar em palavras inteiras, precisa
 * aparecer exatamente no comentário original, sem nome trocado e dentro dos limites de tamanho.
 *
 * @param context - Gemini, medidor de consumo e nomes dos membros.
 * @param comment - Comentário verbatim.
 * @returns O trecho exato, ou undefined se o Gemini falhar ou devolver posições que não servem.
 */
async function askExcerpt(
  { gemini, usage, material }: QuizGeneratorContext,
  comment: string,
): Promise<string | undefined> {
  const scrubbed = scrubNames(comment, material.memberNames);
  let positions: { start: number; end: number };
  try {
    positions = await usage.track('gemini', () =>
      gemini.generateJson({
        model: GEMINI_MODELS.text,
        system: SYSTEM_INSTRUCTION,
        prompt: scrubbed,
        schema: ExcerptPositionsSchema,
        usage,
      }),
    );
  } catch (error) {
    logger.warn('Gemini falhou no trecho do quiz; vale a regra simples', { listId: material.listId, error });
    return undefined;
  }

  const excerpt = snapToWords(scrubbed, positions.start, positions.end).trim();
  const valid =
    excerpt.length >= EXCERPT_LIMITS.min &&
    excerpt.length <= EXCERPT_LIMITS.max &&
    !excerpt.includes(NAME_PLACEHOLDER) &&
    comment.includes(excerpt);
  if (!valid) logger.warn('posições do Gemini não dão um trecho exato', { listId: material.listId, positions });
  return valid ? excerpt : undefined;
}

/**
 * Corta o texto nas posições dadas, recuando o início e avançando o fim até palavras inteiras.
 *
 * @param text - Texto enviado ao Gemini.
 * @param start - Posição do primeiro caractere.
 * @param end - Posição logo depois do último.
 * @returns O pedaço, ou vazio se as posições não fizerem sentido.
 */
function snapToWords(text: string, start: number, end: number): string {
  if (start >= end || start >= text.length) return '';
  const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);
  let from = start;
  let to = Math.min(end, text.length);
  while (from > 0 && isWordChar(text[from - 1]) && isWordChar(text[from])) from--;
  while (to < text.length && isWordChar(text[to - 1]) && isWordChar(text[to])) to++;
  return text.slice(from, to);
}

/**
 * Pergunta "De qual filme é este comentário de vocês?": um trecho verbatim de um comentário, com as
 * palavras do título trocadas por ▇▇▇. O Gemini escolhe o trecho no primeiro comentário sorteado;
 * se falhar, vale uma frase escolhida por regra (e os comentários seguintes, só pela regra).
 *
 * @param context - Material da lista, gerador com semente, Gemini e medidor de consumo.
 * @returns A pergunta, ou undefined se nenhum comentário der um trecho.
 */
async function generateExcerptQuiz(context: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const { material, random } = context;
  const candidates = shuffle(
    material.entries.filter((entry) => entry.comment.trim().length >= EXCERPT_LIMITS.min),
    random,
  );

  let chosen: { entry: RankedEntry; excerpt: string } | undefined;
  for (const [index, entry] of candidates.entries()) {
    const excerpt =
      (index === 0 ? await askExcerpt(context, entry.comment) : undefined) ??
      pickSentenceExcerpt(entry.comment, random);
    if (excerpt) {
      chosen = { entry, excerpt };
      break;
    }
  }
  if (!chosen) return undefined;

  const { entry, excerpt } = chosen;
  const titles = [entry.title, entry.movie?.titlePt ?? ''];
  const others = otherEntries(material.entries, entry, WRONG_OPTIONS, random);
  const seenOn = entry.watchedOn ? `, visto em ${formatDay(entry.watchedOn)}` : '';
  return buildQuestion(
    {
      type: 'trecho',
      prompt: 'De qual filme é este comentário de vocês?',
      media: { excerpt: maskTitleWords(excerpt, titles) },
      explanation: `É o comentário de vocês sobre ${entry.title}, #${entry.rank} no ranking${seenOn}.`,
    },
    { label: movieLabel(entry) },
    others.map((other) => ({ label: movieLabel(other) })),
    random,
  );
}

export { generateExcerptQuiz };

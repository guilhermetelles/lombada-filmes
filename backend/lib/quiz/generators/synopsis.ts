import { logger } from '../../logging/logger.js';
import { NamelessSynopsisSchema } from '../../schemas/quiz-material.js';
import { GEMINI_MODELS } from '../../sources/gemini/gemini-models.js';
import { buildQuestion, type GeneratedQuiz, type QuizGeneratorContext, WRONG_OPTIONS } from '../build-question.js';
import type { RankedEntry } from '../list-material.js';
import { otherEntries } from '../other-entries.js';
import { restedEntries } from '../quiz-history.js';
import { joinPt, maskTitleWords, movieLabel } from '../quiz-text.js';
import { pick } from '../seeded-random.js';

/** Instrução de sistema: reescrever sem nomes, sem acrescentar fatos. */
const SYSTEM_INSTRUCTION = `Você reescreve a sinopse de um filme em português do Brasil sem nenhum nome próprio.
Troque nomes de pessoas, personagens, lugares, empresas e o título por descrições ("um ex-pastor viúvo", "uma cidade pequena").
Não acrescente fatos que não estejam na sinopse e não diga qual é o filme. Até 400 caracteres, uma ou duas frases.
Responda no campo synopsis só o texto reescrito.`;

/** Limites de tamanho da sinopse reescrita. */
const SYNOPSIS_LIMITS = { min: 40, max: 500 } as const;

/**
 * Nomes que não podem aparecer na sinopse reescrita: títulos, quem dirigiu, elenco e personagens.
 *
 * @param entry - Entrada do filme.
 * @returns Os nomes, para conferir com maskTitleWords.
 */
function forbiddenNames(entry: RankedEntry): string[] {
  const movie = entry.movie;
  return [
    entry.title,
    movie?.titlePt ?? '',
    ...(movie?.directors.map((director) => director.name) ?? []),
    ...(movie?.cast.flatMap((member) => [member.name, member.character ?? '']) ?? []),
  ];
}

/**
 * Pergunta "De qual filme é esta sinopse sem nomes?": o Gemini reescreve a sinopse do TMDb sem nomes
 * próprios. A resposta é recusada se trouxer o título ou nomes do elenco, de personagens ou de quem
 * dirigiu; sem Gemini, o tipo fica sem pergunta no dia.
 *
 * @param context - Material da lista, gerador com semente, Gemini e medidor de consumo.
 * @returns A pergunta, ou undefined sem sinopse, sem Gemini ou com nomes na resposta.
 */
async function generateSynopsisQuiz({
  material,
  random,
  gemini,
  usage,
  recentMovieIds,
}: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const target = pick(
    restedEntries(material.entries, recentMovieIds).filter(
      (entry) => entry.movie?.synopsis.pt || entry.movie?.synopsis.en,
    ),
    random,
  );
  const original = target?.movie?.synopsis.pt ?? target?.movie?.synopsis.en;
  if (!target || !original) return undefined;

  let synopsis: string;
  try {
    const reply = await gemini.generateJson({
      model: GEMINI_MODELS.text,
      purpose: 'quiz',
      system: SYSTEM_INSTRUCTION,
      prompt: original,
      schema: NamelessSynopsisSchema,
      usage,
    });
    synopsis = reply.synopsis.trim();
  } catch (error) {
    logger.warn('Gemini falhou na sinopse sem nomes do quiz', { listId: material.listId, error });
    return undefined;
  }
  const fits = synopsis.length >= SYNOPSIS_LIMITS.min && synopsis.length <= SYNOPSIS_LIMITS.max;
  if (!fits || maskTitleWords(synopsis, forbiddenNames(target)) !== synopsis) {
    logger.warn('sinopse do Gemini recusada (tamanho ou nomes)', { listId: material.listId });
    return undefined;
  }

  const directors = target.movie?.directors.map((director) => director.name) ?? [];
  const others = otherEntries(material.entries, target, WRONG_OPTIONS, random);
  return buildQuestion(
    {
      type: 'sinopse',
      prompt: 'De qual filme é esta sinopse sem nomes?',
      media: { synopsis },
      explanation: `É ${movieLabel(target)}${directors.length > 0 ? `, de ${joinPt(directors)}` : ''}.`,
      tmdbId: target.tmdbId,
    },
    { label: movieLabel(target) },
    others.map((entry) => ({ label: movieLabel(entry) })),
    random,
  );
}

export { generateSynopsisQuiz };

import { logger } from '../logging/logger.js';
import type { RankedEntry } from '../quiz/list-material.js';
import { movieLabel } from '../quiz/quiz-text.js';
import { RetroTextSchema } from '../schemas/quiz-material.js';
import { GEMINI_MODELS } from '../sources/gemini/gemini-models.js';
import { NAME_PLACEHOLDER, scrubNames } from '../sources/gemini/scrub-names.js';
import type { GeminiClient } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';

/** Instrução de sistema: curto, só com o que está nos comentários. */
const SYSTEM_INSTRUCTION = `Você escreve a retrospectiva do mês de uma dupla que vê filmes junta e mantém um ranking.
Escreva um parágrafo curto em português do Brasil (2 ou 3 frases, até 320 caracteres), falando com a dupla ("vocês").
Use só o que está nos comentários e nos dados recebidos: não invente fatos, notas, opiniões nem acontecimentos.
Não cite nomes de pessoas e não use "${NAME_PLACEHOLDER}". Responda no campo text só o parágrafo.`;

/** Tamanho máximo aceito do parágrafo. */
const MAX_TEXT_LENGTH = 600;

/**
 * Pede ao Gemini o parágrafo da retrospectiva a partir dos comentários do mês, sem os nomes dos
 * membros. Sem comentários no mês, não pede nada. Se o Gemini falhar ou responder fora do formato
 * (vazio, longo demais ou com nome trocado), a retrospectiva fica sem texto.
 *
 * @param dependencies - Gemini e medidor de consumo.
 * @param monthEntries - Entradas vistas no mês, na ordem do ranking.
 * @param memberNames - Nomes dos membros, tirados dos comentários.
 * @param context - Lista e mês, para o log.
 * @returns O parágrafo, ou null.
 */
async function writeRetroText(
  { gemini, usage }: { gemini: GeminiClient; usage: UsageRecorder },
  monthEntries: readonly RankedEntry[],
  memberNames: readonly string[],
  context: { listId: string; month: string },
): Promise<string | null> {
  const commented = monthEntries.filter((entry) => entry.comment.trim());
  if (commented.length === 0) return null;

  const lines = monthEntries.map((entry) => {
    const comment = entry.comment.trim() ? ` Comentário: ${scrubNames(entry.comment.trim(), memberNames)}` : '';
    return `- #${entry.rank} no ranking: ${movieLabel(entry)}.${comment}`;
  });
  const prompt = `Filmes vistos no mês (${monthEntries.length}):\n${lines.join('\n')}`;

  try {
    const reply = await usage.track('gemini', () =>
      gemini.generateJson({
        model: GEMINI_MODELS.text,
        purpose: 'retro',
        system: SYSTEM_INSTRUCTION,
        prompt,
        schema: RetroTextSchema,
        usage,
      }),
    );
    const text = reply.text.trim();
    if (text && text.length <= MAX_TEXT_LENGTH && !text.includes(NAME_PLACEHOLDER)) return text;
    logger.warn('texto da retrospectiva fora do formato, sem texto', context);
  } catch (error) {
    logger.warn('Gemini falhou na retrospectiva, sem texto', { ...context, error });
  }
  return null;
}

export { writeRetroText };

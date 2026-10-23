import type * as z from 'zod';
import { candidateGenres } from '../discover/score-candidates.js';
import { SourceUnavailableError } from '../errors/app-errors.js';
import { logger } from '../logging/logger.js';
import { RecReasonsReplySchema } from '../schemas/recs.js';
import { GEMINI_MODELS } from '../sources/gemini/gemini-models.js';
import { NAME_PLACEHOLDER, scrubNames } from '../sources/gemini/scrub-names.js';
import type { GeminiClient } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import { sagaName } from './saga-name.js';
import type { ListIndex, ScoredRec } from './score-recs.js';

/** Tamanho máximo de um motivo aceito do Gemini. */
const MAX_REASON_LENGTH = 160;

/** Tamanho mínimo de um motivo aceito do Gemini (abaixo disso não explica nada). */
const MIN_REASON_LENGTH = 12;

/** Trecho máximo de cada comentário enviado (o começo do comentário, verbatim). */
const MAX_COMMENT_LENGTH = 500;

/** Motivos escritos pelo Gemini e, se ele falhou, o porquê (resumido). */
export type GeminiReasons = { reasons: Map<number, string>; failure: string | null };

/** Tamanho máximo do motivo da falha guardado para a saúde da rotina. */
const MAX_FAILURE_LENGTH = 120;

/** Palavras-chave do candidato enviadas, no máximo. */
const MAX_KEYWORDS = 8;

/** Instrução de sistema dos motivos. */
const SYSTEM = [
  'Você escreve o motivo de cada sugestão de filme para uma dupla que mantém junta um ranking dos filmes que viu.',
  'Para cada filme sugerido, escreva uma frase curta em português do Brasil, de até 140 caracteres, dizendo por que ele combina com a dupla.',
  'Use só os dados enviados: o filme sugerido (título, ano, gêneros, direção, saga, palavras-chave) e os filmes da lista que o justificam, com a posição no ranking e o comentário da dupla.',
  'Não invente fatos sobre nenhum filme (enredo, elenco, prêmios, bilheteria) que não estejam nos dados.',
  'Pode citar o título e a posição de um filme da lista e retomar uma ideia do comentário, sem copiar trechos longos.',
  `Não use nomes de pessoas da dupla; ${NAME_PLACEHOLDER} marca um nome removido e não pode aparecer na frase.`,
  'Sem aspas, sem emojis e sem ponto de exclamação. Responda com o tmdbId de cada filme sugerido.',
].join(' ');

/**
 * Pede ao Gemini, num pedido só para a lista inteira, uma frase curta por sugestão, a partir dos
 * dados do TMDb do candidato e dos comentários reais dos filmes da lista que o justificam (com os
 * nomes dos membros trocados por "[nome]"). Motivo vazio, longo demais, com "[nome]" ou de filme
 * que não foi pedido é descartado; quem fica sem motivo usa a reserva por variáveis.
 *
 * @param gemini - Cliente do Gemini.
 * @param usage - Medidor de consumo.
 * @param recs - Sugestões a explicar.
 * @param index - Índice da lista (títulos, posições e comentários).
 * @param memberNames - Nomes dos membros, tirados dos comentários antes do envio.
 * @returns O motivo aceito de cada filme, por tmdbId (vazio se o Gemini falhar ou faltar chave), e
 *   a falha do Gemini resumida, ou null.
 */
async function writeGeminiReasons(
  gemini: GeminiClient,
  usage: UsageRecorder,
  recs: readonly ScoredRec[],
  index: ListIndex,
  memberNames: readonly string[],
): Promise<GeminiReasons> {
  const accepted = new Map<number, string>();
  if (recs.length === 0) return { reasons: accepted, failure: null };

  const wanted = new Set(recs.map((rec) => rec.tmdbId));
  const prompt = JSON.stringify({ sugestoes: recs.map((rec) => describeRec(rec, index, memberNames)) });
  let reply: z.output<typeof RecReasonsReplySchema>;
  try {
    reply = await usage.track('gemini', () =>
      gemini.generateJson({
        model: GEMINI_MODELS.text,
        purpose: 'recs',
        system: SYSTEM,
        prompt,
        schema: RecReasonsReplySchema,
        usage,
      }),
    );
  } catch (error) {
    if (!(error instanceof SourceUnavailableError)) throw error;
    logger.warn('Gemini indisponível; motivos pelas variáveis', { error: error.message });
    return { reasons: accepted, failure: summarizeFailure(error.message) };
  }

  for (const { tmdbId, reason } of reply.reasons) {
    const text = reason.trim().replace(/\s+/g, ' ');
    if (!wanted.has(tmdbId) || accepted.has(tmdbId)) continue;
    if (text.length < MIN_REASON_LENGTH || text.length > MAX_REASON_LENGTH || text.includes(NAME_PLACEHOLDER)) continue;
    accepted.set(tmdbId, text);
  }
  return { reasons: accepted, failure: null };
}

/**
 * Resume a mensagem de erro do Gemini para a saúde da rotina: sem o prefixo da fonte e cortada.
 *
 * @param message - Mensagem do SourceUnavailableError ("gemini: modelo: motivo").
 * @returns O motivo, com até 120 caracteres.
 */
function summarizeFailure(message: string): string {
  const text = message
    .replace(/^gemini:\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > MAX_FAILURE_LENGTH ? `${text.slice(0, MAX_FAILURE_LENGTH - 1)}…` : text;
}

/**
 * Descreve uma sugestão para o Gemini: dados do TMDb do candidato e os filmes da lista que a
 * justificam, com o comentário sem os nomes dos membros.
 *
 * @param rec - Sugestão.
 * @param index - Índice da lista.
 * @param memberNames - Nomes dos membros.
 * @returns O objeto enviado no texto do pedido.
 */
function describeRec(rec: ScoredRec, index: ListIndex, memberNames: readonly string[]) {
  const { movie, candidate } = rec;
  const origins = rec.reasonFrom.flatMap((entryId) => {
    const film = index.byEntryId.get(entryId);
    if (!film) return [];
    const comment = scrubNames(film.comment.slice(0, MAX_COMMENT_LENGTH), memberNames).trim();
    return [{ titulo: film.movie.title, ano: film.movie.year, posicao: film.position, comentario: comment || null }];
  });
  return {
    tmdbId: rec.tmdbId,
    titulo: movie ? (movie.titlePt ?? movie.title) : (candidate?.title ?? ''),
    ano: movie?.year ?? candidate?.year ?? null,
    generos: movie?.genres ?? (candidate ? candidateGenres(candidate) : []),
    direcao: movie?.directors.map((director) => director.name) ?? [],
    saga: movie?.collection ? sagaName(movie.collection.name) : null,
    palavrasChave: (movie?.keywords ?? []).slice(0, MAX_KEYWORDS),
    ligacao: rec.anchor ? { tipo: rec.anchor.via, com: rec.anchor.film.movie.title, nome: rec.anchor.label } : null,
    emAlta:
      rec.source === 'trending' ? 'em alta na semana' : rec.source === 'nowPlaying' ? 'em cartaz no Brasil' : null,
    filmesDaLista: origins,
  };
}

export { writeGeminiReasons };

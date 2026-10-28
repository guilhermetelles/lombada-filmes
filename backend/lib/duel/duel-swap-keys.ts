import { generateKeyBetween } from 'fractional-indexing';
import { ConflictError } from '../errors/app-errors.js';

/** Uma entrada da lista reduzida ao que a troca precisa. */
export type RankedKey = { entryId: string; rankKey: string };

/**
 * Chaves de ordem que põem B na frente de A. Vizinhas: só A muda, para logo abaixo de B. Distantes:
 * cada uma ganha uma chave entre os vizinhos do lugar da outra. Se B já está na frente, nada muda.
 * Mesmo cálculo que o app fazia antes da votação (DuelPair.swapKeys).
 *
 * @param ranking - Entradas na ordem do ranking.
 * @param entryIdA - Entrada que estava na frente quando o duelo abriu.
 * @param entryIdB - Entrada que passa para a frente.
 * @returns Chave nova por id de entrada (vazio se B já está na frente).
 * @throws {ConflictError} Se alguma das duas saiu da lista, ou se as chaves estão empatadas.
 */
function duelSwapKeys(ranking: readonly RankedKey[], entryIdA: string, entryIdB: string): Map<string, string> {
  const i = ranking.findIndex((entry) => entry.entryId === entryIdA);
  const j = ranking.findIndex((entry) => entry.entryId === entryIdB);
  if (i < 0 || j < 0) throw new ConflictError('um dos filmes do duelo saiu da lista');
  if (j < i) return new Map();

  const keyAt = (index: number) => ranking[index]?.rankKey ?? null;
  try {
    if (j === i + 1) return new Map([[entryIdA, generateKeyBetween(keyAt(j), keyAt(j + 1))]]);
    // Os vizinhos de cada lugar não são nenhuma das duas, então as chaves antigas deles servem.
    return new Map([
      [entryIdA, generateKeyBetween(keyAt(j - 1), keyAt(j + 1))],
      [entryIdB, generateKeyBetween(keyAt(i - 1), keyAt(i + 1))],
    ]);
  } catch {
    // Chaves iguais (duas adições ao mesmo tempo) não deixam pôr uma entre as outras.
    throw new ConflictError('as posições estão empatadas; arraste um dos filmes na lista');
  }
}

export { duelSwapKeys };

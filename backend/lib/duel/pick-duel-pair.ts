import { seededFraction } from '../daily/day-seed.js';

/**
 * Sorteia o par de vizinhos do dia: o mesmo dia e a mesma lista dão sempre a mesma posição.
 *
 * @param entries - Entradas na ordem do ranking.
 * @param day - Dia como AAAA-MM-DD.
 * @param listId - Lista (entra na semente, para listas diferentes não terem sempre o mesmo par).
 * @returns A de cima e a de baixo, ou null com menos de dois filmes.
 */
function pickDuelPair<T>(entries: readonly T[], day: string, listId: string): [T, T] | null {
  const pairs = entries.length - 1;
  if (pairs < 1) return null;
  const index = Math.floor(seededFraction(`${day}:duelo:${listId}`) * pairs);
  const first = entries[index];
  const second = entries[index + 1];
  return first && second ? [first, second] : null;
}

export { pickDuelPair };

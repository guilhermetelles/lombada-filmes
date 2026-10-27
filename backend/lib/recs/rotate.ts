import { daysBetween } from '../daily/day-math.js';
import { byScore, DIVERSE_TOP } from './diversify.js';

/** Um ciclo da rotação, em dias. */
const ROTATION_DAYS = 7;

/** Em quantos dias de cada ciclo um filme está na vez. */
const TURN_DAYS = 2;

/** Dia de referência da contagem dos dias. */
const EPOCH_DAY = '1970-01-01';

/**
 * Fase fixa de um filme na rotação (0 a 6), pelos bits altos de um hash multiplicativo do id, para
 * ids vizinhos não caírem na mesma fase.
 *
 * @param tmdbId - Id do filme.
 * @returns A fase.
 */
export function rotationPhase(tmdbId: number): number {
  return Math.floor(((Math.imul(tmdbId, 2654435761) >>> 0) * ROTATION_DAYS) / 2 ** 32);
}

/**
 * Diz se o filme está na vez no dia: cada filme fica na vez em 2 dias seguidos de cada 7. A cada
 * dia sai um grupo de fase e entra outro, sem nada guardado.
 *
 * @param tmdbId - Id do filme.
 * @param today - Dia AAAA-MM-DD (Brasília).
 * @returns true se o filme está na vez.
 */
export function isOnTurn(tmdbId: number, today: string): boolean {
  return (daysBetween(EPOCH_DAY, today) + rotationPhase(tmdbId)) % ROTATION_DAYS < TURN_DAYS;
}

/**
 * Separa os filmes da vez: todos os da vez e, se forem menos de 10, os de maior nota fora da vez
 * até completar 10 (lista pequena nunca fica sem topo).
 *
 * @param items - Itens com id e nota.
 * @param today - Dia AAAA-MM-DD (Brasília).
 * @param minimum - Quantos itens, no mínimo, ficam na vez.
 * @returns Os da vez (com os de complemento) e os que ficam de fora.
 */
export function splitByTurn<T extends { tmdbId: number; score: number }>(
  items: readonly T[],
  today: string,
  minimum = DIVERSE_TOP,
): { onTurn: T[]; offTurn: T[] } {
  const ordered = byScore(items);
  const onTurn = ordered.filter((item) => isOnTurn(item.tmdbId, today));
  const offTurn = ordered.filter((item) => !isOnTurn(item.tmdbId, today));
  const filling = offTurn.splice(0, Math.max(0, minimum - onTurn.length));
  return { onTurn: byScore([...onTurn, ...filling]), offTurn };
}

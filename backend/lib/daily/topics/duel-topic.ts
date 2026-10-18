import type { DailyContent, DailyContext } from '../daily-content.js';
import { seededFraction } from '../day-seed.js';

/**
 * Duelo de revisão: duas entradas vizinhas no ranking, sorteadas no dia (as mesmas o dia todo).
 *
 * @param context - Lista e dia.
 * @returns A notificação, ou null com menos de dois filmes na lista.
 */
async function composeDuel({ list, day }: DailyContext): Promise<DailyContent | null> {
  const pairs = list.entries.length - 1;
  if (pairs < 1) return null;
  const index = Math.floor(seededFraction(`${day}:duelo:${list.listId}`) * pairs);
  const first = list.entries[index];
  const second = list.entries[index + 1];
  if (!first || !second) return null;

  return {
    type: 'daily.duel',
    title: 'Duelo de revisão',
    body: `Vocês ainda acham que ${first.movie.title} (#${first.position}) é melhor que ${second.movie.title} (#${second.position})?`,
    route: { name: 'duel', args: { entryId: first.entryId, entryIdB: second.entryId } },
  };
}

export { composeDuel };

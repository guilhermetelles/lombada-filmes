import { pickDuelPair } from '../../duel/pick-duel-pair.js';
import type { DailyContent, DailyContext } from '../daily-content.js';

/**
 * Duelo de revisão: duas entradas vizinhas no ranking, sorteadas no dia (as mesmas o dia todo). A
 * rota leva o par, e o primeiro a abrir o duelo grava esse par em duels/{dia}.
 *
 * @param context - Lista e dia.
 * @returns A notificação, ou null com menos de dois filmes na lista.
 */
async function composeDuel({ list, day }: DailyContext): Promise<DailyContent | null> {
  const pair = pickDuelPair(list.entries, day, list.listId);
  if (!pair) return null;
  const [first, second] = pair;

  return {
    type: 'daily.duel',
    title: 'Duelo de revisão',
    body: `Vocês ainda acham que ${first.movie.title} (#${first.position}) é melhor que ${second.movie.title} (#${second.position})?`,
    route: { name: 'duel', args: { entryId: first.entryId, entryIdB: second.entryId } },
  };
}

export { composeDuel };

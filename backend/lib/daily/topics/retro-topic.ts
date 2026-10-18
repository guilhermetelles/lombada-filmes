import { notifyLogDocument } from '../../notify/notify-repository.js';
import { formatHours, monthName, plural } from '../../notify/portuguese-text.js';
import { RetroSchema } from '../../schemas/retro.js';
import { previousMonth } from '../../time/brazil-day.js';
import type { DailyContent, DailyContext } from '../daily-content.js';

/** Até que dia do mês a retrospectiva do mês anterior ainda vira notificação. */
const LAST_DAY = 3;

/**
 * Retrospectiva do mês: só nos dias 1 a 3, se a rotina já gravou lists/{listId}/retros/{mês
 * anterior} e a pessoa ainda não recebeu essa retrospectiva num dia anterior do mês.
 *
 * @param context - Banco, lista, pessoa e dia.
 * @returns A notificação, ou null fora dos dias 1 a 3, sem retrospectiva ou se já foi enviada.
 */
async function composeRetro({ dependencies, list, uid, day }: DailyContext): Promise<DailyContent | null> {
  const dayOfMonth = Number(day.slice(8, 10));
  if (dayOfMonth > LAST_DAY) return null;
  const { db } = dependencies;
  const month = previousMonth(day.slice(0, 7));

  const retro = RetroSchema.safeParse((await db.doc(`lists/${list.listId}/retros/${month}`).get()).data());
  if (!retro.success || retro.data.films === 0) return null;

  const earlierDays = Array.from({ length: dayOfMonth - 1 }, (_, index) => `${day.slice(0, 8)}0${index + 1}`);
  if (earlierDays.length > 0) {
    const logs = await db.getAll(...earlierDays.map((earlier) => notifyLogDocument(db, uid, earlier)));
    if (logs.some((log) => log.data()?.type === 'daily.retro')) return null;
  }

  const { films, minutes, bestEntryId } = retro.data;
  const best = list.entries.find((entry) => entry.entryId === bestEntryId);
  const bestText = best ? ` O melhor do mês está em #${best.position}: ${best.movie.title}.` : '';
  return {
    type: 'daily.retro',
    title: `Retrospectiva de ${monthName(month)}`,
    body: `${plural(films, 'filme', 'filmes')} e ${formatHours(minutes)} de filme juntos.${bestText}`,
    route: { name: 'retro', args: { month } },
  };
}

export { composeRetro };

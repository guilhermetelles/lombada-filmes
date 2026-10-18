import { formatDay, formatHours, plural } from '../../notify/portuguese-text.js';
import { DAY_MS } from '../../time/durations.js';
import type { DailyContent, DailyContext } from '../daily-content.js';
import { isDay } from '../day-math.js';

/** Quantos dias para trás contam como "acabou de passar". */
const RECENT_DAYS = 7;

/** De quantos em quantos filmes há um marco. */
const FILMS_STEP = 10;

/** De quantas em quantas horas de filme há um marco. */
const HOURS_STEP = 50;

/**
 * Marco da lista: a contagem de filmes (de 10 em 10) ou de horas de filme (de 50 em 50) que
 * passou de um número redondo com as entradas dos últimos 7 dias.
 *
 * @param context - Lista e momento.
 * @returns A notificação, ou null se nenhum número redondo foi passado agora.
 */
async function composeMilestone({ list, now }: DailyContext): Promise<DailyContent | null> {
  const since = now.getTime() - RECENT_DAYS * DAY_MS;
  const runtime = (tmdbId: number) => list.movies.get(tmdbId)?.runtime ?? 0;
  const older = list.entries.filter((entry) => entry.createdAt.getTime() < since);

  const films = list.entries.length;
  const minutes = list.entries.reduce((sum, entry) => sum + runtime(entry.tmdbId), 0);
  const olderMinutes = older.reduce((sum, entry) => sum + runtime(entry.tmdbId), 0);

  const filmsMark = crossed(older.length, films, FILMS_STEP);
  const hoursMark = crossed(olderMinutes / 60, minutes / 60, HOURS_STEP);
  const title =
    filmsMark !== null
      ? `Vocês chegaram a ${filmsMark} filmes`
      : hoursMark !== null
        ? `Vocês passaram de ${hoursMark} horas de filme`
        : null;
  if (title === null) return null;

  const first = list.entries
    .map((entry) => entry.watchedOn)
    .filter(isDay)
    .sort()[0];
  const sinceFirst = first ? ` desde ${formatDay(first)}` : '';
  return {
    type: 'daily.milestone',
    title,
    body: `São ${plural(films, 'filme', 'filmes')} e ${formatHours(minutes)} de filme juntos${sinceFirst}.`,
    route: { name: 'reports' },
  };
}

/**
 * Diz qual múltiplo de `step` a contagem passou entre antes e agora.
 *
 * @param before - Contagem antes (há 7 dias).
 * @param after - Contagem agora.
 * @param step - Passo dos números redondos.
 * @returns O maior múltiplo passado, ou null se nenhum.
 */
function crossed(before: number, after: number, step: number): number | null {
  const mark = Math.floor(after / step) * step;
  return mark >= step && Math.floor(before / step) < mark / step ? mark : null;
}

export { composeMilestone };

import type { RankedEntry } from '../../events/list-entries.js';
import { formatDay } from '../../notify/portuguese-text.js';
import type { DailyContent, DailyContext } from '../daily-content.js';
import { daysBetween, isDay } from '../day-math.js';
import { seededFraction } from '../day-seed.js';

/** Dias desde que viram o filme para o comentário poder voltar. */
const MIN_DAYS = 30;

/** Tolerância, em dias, para contar como aniversário (1, 2… anos) do dia em que viram. */
const ANNIVERSARY_TOLERANCE = 10;

/** Até quantos dias o sorteio do dia pode puxar um comentário mais novo à frente de um mais antigo. */
const JITTER_DAYS = 120;

/** Dias de um ano, em média. */
const YEAR_DAYS = 365.25;

/**
 * Comentário do dia: primeiro os aniversários (perto de 1, 2… anos do dia em que viram, com 10
 * dias de tolerância), o mais perto da data na frente; sem aniversário, os mais antigos, com um
 * sorteio fixo do dia para variar. Só entradas com comentário, vistas há 30 dias ou mais.
 *
 * @param context - Lista e dia.
 * @returns A notificação, com o comentário verbatim, ou null se nenhum comentário servir.
 */
async function composeMemory({ list, day }: DailyContext): Promise<DailyContent | null> {
  const candidates = list.entries.flatMap((entry) => {
    if (entry.comment.trim() === '' || !isDay(entry.watchedOn)) return [];
    const days = daysBetween(entry.watchedOn, day);
    return days >= MIN_DAYS ? [{ entry, watchedOn: entry.watchedOn, days }] : [];
  });
  const jitter = (entry: RankedEntry) => Math.floor(seededFraction(`${day}:memoria:${entry.entryId}`) * JITTER_DAYS);

  candidates.sort((a, b) => {
    const gapA = anniversaryGap(a.days);
    const gapB = anniversaryGap(b.days);
    const isA = gapA <= ANNIVERSARY_TOLERANCE;
    const isB = gapB <= ANNIVERSARY_TOLERANCE;
    if (isA !== isB) return isA ? -1 : 1;
    if (isA) return gapA - gapB;
    return b.days + jitter(b.entry) - (a.days + jitter(a.entry));
  });

  const [pick] = candidates;
  if (!pick) return null;
  return {
    type: 'daily.memory',
    title: `${agoText(pick.days)}, sobre ${pick.entry.movie.title}`,
    body: `Visto em ${formatDay(pick.watchedOn)}; hoje em #${pick.entry.position} na lista.`,
    quote: pick.entry.comment,
    route: { name: 'memory', args: { entryId: pick.entry.entryId } },
  };
}

/**
 * Distância, em dias, até o aniversário mais próximo do dia em que viram.
 *
 * @param days - Dias desde que viram.
 * @returns A distância, ou Infinity antes de completar perto de 1 ano.
 */
function anniversaryGap(days: number): number {
  const years = Math.round(days / YEAR_DAYS);
  return years >= 1 ? Math.abs(days - years * YEAR_DAYS) : Number.POSITIVE_INFINITY;
}

/**
 * Quanto tempo faz, por extenso: "Há 1 ano", "Há 3 meses", "Há 5 semanas".
 *
 * @param days - Dias desde que viram.
 * @returns O texto.
 */
function agoText(days: number): string {
  const years = Math.round(days / YEAR_DAYS);
  if (anniversaryGap(days) <= ANNIVERSARY_TOLERANCE) return years === 1 ? 'Há 1 ano' : `Há ${years} anos`;
  if (days >= 60) return `Há ${Math.round(days / 30.44)} meses`;
  return `Há ${Math.round(days / 7)} semanas`;
}

export { composeMemory };

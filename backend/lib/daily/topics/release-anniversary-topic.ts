import { formatDay } from '../../notify/portuguese-text.js';
import type { DailyContent, DailyContext } from '../daily-content.js';
import { nearestAnniversary } from '../day-math.js';
import { whenText, yearsText } from './anniversary-text.js';

/** Até quantos dias antes ou depois o aniversário de estreia vale (a mesma semana). */
const WINDOW_DAYS = 6;

/**
 * Aniversário de estreia: o filme da lista cuja data de estreia (`release` de movies/) faz
 * aniversário mais perto de hoje, até 6 dias antes ou depois, com pelo menos 1 ano.
 *
 * @param context - Lista e dia.
 * @returns A notificação, ou null se nenhum filme fizer aniversário de estreia nesta semana.
 */
async function composeReleaseAnniversary({ list, day }: DailyContext): Promise<DailyContent | null> {
  const candidates = list.entries.flatMap((entry) => {
    const release = list.releases.get(entry.tmdbId);
    if (!release) return [];
    const anniversary = nearestAnniversary(release, day);
    return Math.abs(anniversary.gap) <= WINDOW_DAYS && anniversary.years >= 1 ? [{ entry, release, anniversary }] : [];
  });
  candidates.sort(
    (a, b) => Math.abs(a.anniversary.gap) - Math.abs(b.anniversary.gap) || a.entry.position - b.entry.position,
  );

  const [pick] = candidates;
  if (!pick) return null;
  const { gap, years } = pick.anniversary;
  const verb = gap < 0 ? 'fez' : 'faz';
  return {
    type: 'daily.releaseAnniversary',
    title: `${pick.entry.movie.title} ${verb} ${yearsText(years)} de estreia ${whenText(pick.anniversary)}`,
    body: `Lançado em ${formatDay(pick.release)}; está em #${pick.entry.position} na lista de vocês.`,
    route: { name: 'movie', args: { tmdbId: pick.entry.tmdbId } },
  };
}

export { composeReleaseAnniversary };

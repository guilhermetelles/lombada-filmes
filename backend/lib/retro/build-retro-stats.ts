import type { RankedEntry } from '../quiz/list-material.js';
import type { Retro } from '../types/retro.js';

/** Números da retrospectiva, sem o texto e sem a data de geração. */
export type RetroStats = Pick<Retro, 'films' | 'minutes' | 'bestEntryId' | 'worstEntryId' | 'genres'>;

/**
 * Calcula os números da retrospectiva de um mês: filmes vistos no mês (pela data registrada na
 * entrada), minutos somados, o mais bem e o mais mal colocado no ranking (com um filme só, não há
 * pior) e os gêneros, do mais visto para o menos (empate em ordem alfabética).
 *
 * @param entries - Entradas da lista, na ordem do ranking.
 * @param month - Mês (AAAA-MM).
 * @returns Os números e as entradas do mês, na ordem do ranking.
 */
function buildRetroStats(
  entries: readonly RankedEntry[],
  month: string,
): { stats: RetroStats; monthEntries: RankedEntry[] } {
  const monthEntries = entries.filter((entry) => entry.watchedOn?.startsWith(`${month}-`));
  const counts = new Map<string, number>();
  for (const entry of monthEntries) {
    for (const genre of new Set(entry.movie?.genres ?? [])) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  const genres = [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre, 'pt-BR'));

  const best = monthEntries[0];
  const worst = monthEntries.length > 1 ? monthEntries.at(-1) : undefined;
  return {
    stats: {
      films: monthEntries.length,
      minutes: monthEntries.reduce((total, entry) => total + (entry.movie?.runtime ?? 0), 0),
      bestEntryId: best?.entryId ?? null,
      worstEntryId: worst?.entryId ?? null,
      genres,
    },
    monthEntries,
  };
}

export { buildRetroStats };

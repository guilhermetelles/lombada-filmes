import type { RankedEntry } from './list-material.js';
import { movieLabel } from './quiz-text.js';
import { type Random, shuffle } from './seeded-random.js';

/**
 * Escolhe outros filmes da lista para as alternativas erradas, preferindo os que dividem um gênero
 * com o certo (ficam mais plausíveis). Não repete filme nem rótulo, e nunca usa o rótulo do certo.
 *
 * @param entries - Entradas da lista.
 * @param target - Entrada da alternativa certa.
 * @param count - Quantos filmes devolver.
 * @param random - Gerador com semente.
 * @param accept - Filtro extra (ex.: só filmes com pôster).
 * @returns Até `count` entradas; menos se a lista não tiver filmes suficientes.
 */
function otherEntries(
  entries: readonly RankedEntry[],
  target: RankedEntry,
  count: number,
  random: Random,
  accept: (entry: RankedEntry) => boolean = () => true,
): RankedEntry[] {
  const targetGenres = new Set(target.movie?.genres ?? []);
  const pool = entries.filter((entry) => entry.tmdbId !== target.tmdbId && accept(entry));
  const sharesGenre = (entry: RankedEntry) => (entry.movie?.genres ?? []).some((genre) => targetGenres.has(genre));
  const near = shuffle(pool.filter(sharesGenre), random);
  const far = shuffle(
    pool.filter((entry) => !sharesGenre(entry)),
    random,
  );

  const seen = new Set([movieLabel(target)]);
  const chosen: RankedEntry[] = [];
  for (const entry of [...near, ...far]) {
    if (chosen.length === count) break;
    const label = movieLabel(entry);
    if (seen.has(label)) continue;
    seen.add(label);
    chosen.push(entry);
  }
  return chosen;
}

export { otherEntries };

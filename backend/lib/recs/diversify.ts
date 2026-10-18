import { tagSimilarity } from './movie-features.js';

/** Quantos primeiros lugares passam pela variedade. */
const DIVERSE_TOP = 10;

/** Peso da nota contra a semelhança com os já escolhidos (MMR). */
const MMR_LAMBDA = 0.8;

/** O que a variedade precisa de cada item. */
export type DiversifyItem = {
  score: number;
  groups: readonly string[]; // saga e diretores, como `collection:10` e `director:2710`
  tags: ReadonlyMap<string, number>;
};

/**
 * Ordena com variedade (MMR): os 10 primeiros lugares vão, um a um, para o item com a maior
 * 0,8 × nota − 0,2 × 100 × semelhança com os já escolhidos, sem repetir saga nem diretor (no máximo 1
 * por saga e por diretor). O resto segue da maior nota para a menor.
 *
 * @param items - Itens com nota, grupos e marcas.
 * @returns Os mesmos itens, na nova ordem.
 */
function diversify<T extends DiversifyItem>(items: readonly T[]): T[] {
  const remaining = [...items].sort((a, b) => b.score - a.score);
  const chosen: T[] = [];
  const usedGroups = new Set<string>();

  while (chosen.length < DIVERSE_TOP && remaining.length > 0) {
    let bestIndex = -1;
    let bestValue = Number.NEGATIVE_INFINITY;
    remaining.forEach((item, index) => {
      if (item.groups.some((group) => usedGroups.has(group))) return;
      const redundancy = chosen.reduce((max, other) => Math.max(max, tagSimilarity(item.tags, other.tags)), 0);
      const value = MMR_LAMBDA * item.score - (1 - MMR_LAMBDA) * 100 * redundancy;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });
    if (bestIndex < 0) break;
    const [picked] = remaining.splice(bestIndex, 1);
    if (!picked) break;
    chosen.push(picked);
    for (const group of picked.groups) usedGroups.add(group);
  }
  return [...chosen, ...remaining];
}

export { diversify };

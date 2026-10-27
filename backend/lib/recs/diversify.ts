import { tagSimilarity } from './movie-features.js';

/** Quantos primeiros lugares passam pela variedade. */
export const DIVERSE_TOP = 10;

/** Peso da nota contra a semelhança com os já escolhidos (MMR). */
const MMR_LAMBDA = 0.8;

/** Prefixo dos grupos de origem (de qual filme ou fonte veio o candidato). */
export const ORIGIN_PREFIX = 'origin:';

/** Quantos dos primeiros lugares podem vir da mesma origem. */
const ORIGIN_LIMIT = 2;

/** O que a variedade precisa de cada item. */
export type DiversifyItem = {
  tmdbId: number;
  score: number;
  groups: readonly string[]; // saga, diretores e origem, como `collection:10`, `director:2710` e `origin:seed:603`
  tags: ReadonlyMap<string, number>;
};

/**
 * Ordena da maior nota para a menor; empate pelo id, para a ordem não depender de quando cada
 * filme foi buscado.
 *
 * @param items - Itens com nota.
 * @returns Uma cópia ordenada.
 */
export function byScore<T extends { tmdbId: number; score: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.score - a.score || a.tmdbId - b.tmdbId);
}

/**
 * Ordena com variedade (MMR): os 10 primeiros lugares vão, um a um, para o item com a maior
 * 0,8 × nota − 0,2 × 100 × semelhança com os já escolhidos, com no máximo 1 por saga e por diretor
 * e 2 por origem. O resto segue da maior nota para a menor.
 *
 * @param items - Itens com nota, grupos e marcas.
 * @returns Os mesmos itens, na nova ordem.
 */
function diversify<T extends DiversifyItem>(items: readonly T[]): T[] {
  const remaining = byScore(items);
  const chosen: T[] = [];
  const usedGroups = new Map<string, number>();
  const isFull = (group: string) =>
    (usedGroups.get(group) ?? 0) >= (group.startsWith(ORIGIN_PREFIX) ? ORIGIN_LIMIT : 1);

  while (chosen.length < DIVERSE_TOP && remaining.length > 0) {
    let bestIndex = -1;
    let bestValue = Number.NEGATIVE_INFINITY;
    remaining.forEach((item, index) => {
      if (item.groups.some(isFull)) return;
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
    for (const group of picked.groups) usedGroups.set(group, (usedGroups.get(group) ?? 0) + 1);
  }
  return [...chosen, ...remaining];
}

export { diversify };

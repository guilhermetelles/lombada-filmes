/** Sorteio fixo por dia: a mesma semente escolhe sempre o mesmo item, e rodar de novo dá o mesmo resultado. */

/**
 * Transforma um texto num número entre 0 (inclusive) e 1 (exclusive), sempre o mesmo para o mesmo
 * texto (FNV-1a de 32 bits seguido de uma rodada do mulberry32, para espalhar sementes parecidas).
 *
 * @param seed - Semente, como "2026-10-18:duelo".
 * @returns O número sorteado.
 */
export function seededFraction(seed: string): number {
  let hash = 0x811c9dc5;
  for (const char of seed) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let t = (hash + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Sorteia um item com semente fixa.
 *
 * @param items - Itens.
 * @param seed - Semente.
 * @returns O item sorteado, ou undefined se não houver itens.
 */
export function pickSeeded<T>(items: readonly T[], seed: string): T | undefined {
  return items[Math.floor(seededFraction(seed) * items.length)];
}

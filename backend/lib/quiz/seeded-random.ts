/** Gerador de números pseudoaleatórios: devolve um número em [0, 1) a cada chamada. */
export type Random = () => number;

/**
 * Cria um gerador pseudoaleatório com semente: o mesmo texto dá sempre a mesma sequência, para a
 * pergunta do dia sair igual se a rotina rodar de novo (hash FNV-1a da semente e mistura do
 * murmur3, como o mock).
 *
 * @param seed - Semente, como "2026-10-18|{listId}".
 * @returns O gerador.
 */
export function createSeededRandom(seed: string): Random {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619);
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

/**
 * Embaralha uma cópia da lista (Fisher-Yates) com o gerador dado.
 *
 * @param items - Itens a embaralhar; a lista original não muda.
 * @param random - Gerador com semente.
 * @returns Os mesmos itens em outra ordem.
 */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const current = copy[index] as T;
    copy[index] = copy[other] as T;
    copy[other] = current;
  }
  return copy;
}

/**
 * Sorteia um item da lista.
 *
 * @param items - Itens possíveis.
 * @param random - Gerador com semente.
 * @returns O item sorteado, ou undefined se a lista estiver vazia.
 */
export function pick<T>(items: readonly T[], random: Random): T | undefined {
  return items[Math.floor(random() * items.length)];
}

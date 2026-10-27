import { tagSimilarity } from './movie-features.js';

/** Quantos vizinhos (filmes da lista mais parecidos) contam. */
const NEIGHBOR_COUNT = 3;

/** Semelhança mínima para um filme da lista contar como vizinho. */
export const MIN_SIMILARITY = 0.08;

/** Peso máximo dos vizinhos na nota final (o resto é o modelo). */
const NEIGHBOR_WEIGHT = 0.3;

/** Semelhança média a partir da qual os vizinhos valem o peso inteiro. */
export const FULL_SIMILARITY = 0.3;

/** Um filme da lista com as marcas dele, para achar vizinhos. */
export type ListTags = { entryId: string; position: number; tags: ReadonlyMap<string, number> };

/** Um vizinho: filme da lista parecido com o candidato. */
export type Neighbor = { entryId: string; position: number; similarity: number };

/**
 * Acha os filmes da lista mais parecidos com o candidato.
 *
 * @param tags - Marcas do candidato.
 * @param list - Marcas de cada filme da lista, com a posição.
 * @returns Até 3 vizinhos, do mais parecido para o menos (no empate, o mais alto na lista).
 */
export function findNeighbors(tags: ReadonlyMap<string, number>, list: readonly ListTags[]): Neighbor[] {
  return list
    .map(({ entryId, position, tags: listTags }) => ({ entryId, position, similarity: tagSimilarity(tags, listTags) }))
    .filter(({ similarity }) => similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity || a.position - b.position)
    .slice(0, NEIGHBOR_COUNT);
}

/**
 * Nota dos vizinhos: a média das posições deles na lista, ponderada pela semelhança, com o topo
 * valendo 100 e o último 0.
 *
 * @param neighbors - Vizinhos do candidato.
 * @param listSize - Quantos filmes a lista tem.
 * @returns De 0 a 100, ou null sem vizinhos.
 */
export function neighborScore(neighbors: readonly Neighbor[], listSize: number): number | null {
  if (neighbors.length === 0) return null;
  let weighted = 0;
  let totalSimilarity = 0;
  for (const { position, similarity } of neighbors) {
    const quality = listSize <= 1 ? 1 : 1 - (position - 1) / (listSize - 1);
    weighted += similarity * quality;
    totalSimilarity += similarity;
  }
  return (100 * weighted) / totalSimilarity;
}

/**
 * Soma os vizinhos à nota do modelo: média ponderada, com os vizinhos pesando até 30% quanto mais
 * parecidos forem.
 *
 * @param model - Nota do modelo (0 a 100).
 * @param neighbors - Vizinhos do candidato.
 * @param listSize - Quantos filmes a lista tem.
 * @returns A compatibilidade, inteira de 0 a 100.
 */
export function combineScores(model: number, neighbors: readonly Neighbor[], listSize: number): number {
  const fromNeighbors = neighborScore(neighbors, listSize);
  if (fromNeighbors === null) return Math.round(model);
  const meanSimilarity = neighbors.reduce((sum, { similarity }) => sum + similarity, 0) / neighbors.length;
  const weight = NEIGHBOR_WEIGHT * Math.min(1, meanSimilarity / FULL_SIMILARITY);
  return Math.max(0, Math.min(100, Math.round((1 - weight) * model + weight * fromNeighbors)));
}

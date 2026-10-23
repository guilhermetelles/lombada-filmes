import type { DiscoverSort } from '../types/discover.js';

/** Peso da posição no TMDb na ordem por relevância; o resto é da compatibilidade. */
export const RELEVANCE_TMDB_WEIGHT = 0.5;

/** O que a ordem usa de cada filme. */
export type Rankable = {
  tmdbIndex: number; // posição na página do TMDb (0 = o mais popular)
  score: number; // compatibilidade, de 0 a 100
  matches: number; // palavras-chave da frase que o filme tem
};

/**
 * Ordena os filmes da página. Em qualquer ordem, quem tem mais palavras-chave da frase vem antes.
 * Depois, em `compat`, decide a compatibilidade; em `relevance`, a média entre a posição no TMDb
 * (que já reflete os filtros e a popularidade) e a compatibilidade, as duas levadas para 0 a 1
 * dentro da página: a compatibilidade ajusta a ordem do TMDb em vez de substituí-la. Em 2026-10-23,
 * ordenando só pela compatibilidade, de 0 a 2 dos 5 primeiros do TMDb seguiam no top 5, por
 * diferenças de poucos pontos. No empate, vale a ordem do TMDb.
 *
 * @param items - Filmes da página.
 * @param sort - Relevância ou compatibilidade.
 * @param pageSize - Quantos filmes o TMDb mandou na página (para levar a posição a 0 a 1).
 * @returns Uma cópia ordenada.
 */
function orderResults<T extends Rankable>(items: readonly T[], sort: DiscoverSort, pageSize: number): T[] {
  const scores = items.map((item) => item.score);
  const lowest = Math.min(...scores);
  const range = Math.max(...scores) - lowest;
  const lastIndex = Math.max(1, pageSize - 1);
  const weight = (item: T) => {
    if (sort === 'compat') return item.score;
    const position = 1 - Math.min(item.tmdbIndex, lastIndex) / lastIndex;
    const compat = range === 0 ? 0.5 : (item.score - lowest) / range;
    return RELEVANCE_TMDB_WEIGHT * position + (1 - RELEVANCE_TMDB_WEIGHT) * compat;
  };
  return [...items].sort((a, b) => b.matches - a.matches || weight(b) - weight(a) || a.tmdbIndex - b.tmdbIndex);
}

export { orderResults };

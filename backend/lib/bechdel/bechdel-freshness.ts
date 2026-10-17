import { DAY_MS } from '../time/durations.js';
import type { Movie } from '../types/movie.js';

/** Filme casado: a página é lida de novo depois de 30 dias (a rotina atualiza a nota pelo índice). */
const MATCHED_FRESHNESS_MS = 30 * DAY_MS;
/** Filme que não está no site: procurado de novo depois de 7 dias (filmes novos entram no site). */
const NOT_FOUND_FRESHNESS_MS = 7 * DAY_MS;

/**
 * Diz se o Teste de Bechdel do filme precisa ser buscado ao abrir o filme: nunca buscado, casado
 * há 30 dias ou mais, ou não encontrado há 7 dias ou mais.
 *
 * @param movie - Documento guardado.
 * @param now - Momento de referência.
 * @returns true se estiver vencido.
 */
function isBechdelStale(movie: Movie, now: Date): boolean {
  const bechdel = movie.bechdel;
  if (!bechdel) return true;
  const freshness = bechdel.siteId === null ? NOT_FOUND_FRESHNESS_MS : MATCHED_FRESHNESS_MS;
  return now.getTime() - bechdel.fetchedAt.getTime() >= freshness;
}

/**
 * Diz se a rotina diária deve tentar casar o filme: nunca buscado, ou não encontrado há 7 dias ou
 * mais. Os casados ela atualiza pelo índice, sem ler a página.
 *
 * @param movie - Documento guardado.
 * @param now - Momento de referência.
 * @returns true se o filme ainda não está casado e venceu.
 */
function needsBechdelMatch(movie: Movie, now: Date): boolean {
  if (typeof movie.bechdel?.siteId === 'number') return false;
  return isBechdelStale(movie, now);
}

export { isBechdelStale, MATCHED_FRESHNESS_MS, NOT_FOUND_FRESHNESS_MS, needsBechdelMatch };

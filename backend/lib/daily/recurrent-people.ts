import { findRecurrentPeople } from '../enrich/enrich-targets.js';
import type { DailyList } from './daily-content.js';

/** Quantas pessoas do elenco contam, na ordem dos créditos (o mesmo corte da rotina enrich). */
const CAST_LIMIT = 8;

/** Uma pessoa ligada à lista e os filmes da lista em que ela dirigiu ou atuou. */
export type LinkedPerson = { personId: number; directed: string[]; acted: string[] };

/**
 * Pessoas recorrentes da lista (dirigem ou estão entre os 8 primeiros do elenco de 2 ou mais
 * filmes dela, o mesmo critério com que a rotina enrich busca as fichas), com os títulos dos
 * filmes da lista em que aparecem, na ordem do ranking.
 *
 * @param list - Lista lida pela rotina.
 * @returns As pessoas, por id de pessoa do TMDb.
 */
function recurrentPeople(list: DailyList): Map<number, LinkedPerson> {
  const tmdbIds = list.entries.map((entry) => entry.tmdbId);
  const ids = findRecurrentPeople(new Map([[list.listId, tmdbIds]]), list.movies);
  const people = new Map<number, LinkedPerson>(
    ids.map((personId) => [personId, { personId, directed: [], acted: [] }]),
  );

  for (const entry of list.entries) {
    const movie = list.movies.get(entry.tmdbId);
    if (!movie) continue;
    for (const director of movie.directors) people.get(director.id)?.directed.push(entry.movie.title);
    for (const member of movie.cast.slice(0, CAST_LIMIT)) people.get(member.id)?.acted.push(entry.movie.title);
  }
  return people;
}

export { recurrentPeople };

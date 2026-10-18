import type { CandidatePage, DiscoverCandidate } from '../../discover/tmdb-discover-client.js';
import { logger } from '../../logging/logger.js';
import type { DailyContent, DailyContext } from '../daily-content.js';
import { addDays } from '../day-math.js';
import { type LinkedPerson, recurrentPeople } from '../recurrent-people.js';

/** Quantas pessoas da lista vão na busca (o TMDb junta com "ou"). */
const MAX_PEOPLE = 40;

/** Quantos filmes encontrados conferir nos créditos, por busca. */
const MAX_CHECKS = 3;

/** Janelas da busca: o que vai estrear nos próximos 60 dias e o que estreou nos últimos 30. */
const WINDOWS = [
  { name: 'upcoming', from: 0, to: 60, title: 'Vai estrear no Brasil' },
  { name: 'nowPlaying', from: -30, to: -1, title: 'Em cartaz no Brasil' },
] as const;

/**
 * Estreia de alguém da lista: filme que estreia nos cinemas do Brasil nos próximos 60 dias (ou que
 * estreou nos últimos 30) com diretor da lista ou alguém recorrente do elenco. Busca no /discover
 * do TMDb (região BR, lançamento nos cinemas, `with_people`) e confirma o vínculo nos créditos do
 * filme; sem vínculo confirmado, não há notificação.
 *
 * @param context - Fontes, consumo, lista e dia.
 * @returns A notificação, ou null se nada estrear com gente da lista (ou se o TMDb falhar).
 */
async function composeRelease({ dependencies, usage, list, day }: DailyContext): Promise<DailyContent | null> {
  const people = linkedPeople(list);
  if (people.size === 0) return null;
  const inList = new Set(list.entries.map((entry) => entry.tmdbId));
  const { tmdb, tmdbDiscover } = dependencies.sources;

  try {
    for (const window of WINDOWS) {
      const params = new URLSearchParams({
        language: 'pt-BR',
        region: 'BR',
        with_release_type: '2|3',
        'release_date.gte': addDays(day, window.from),
        'release_date.lte': addDays(day, window.to),
        with_people: [...people.keys()].slice(0, MAX_PEOPLE).join('|'),
        sort_by: 'popularity.desc',
        include_adult: 'false',
        page: '1',
      });
      const page: CandidatePage = await usage.track('tmdb', () => tmdbDiscover.discover(params));
      const found = page.results.filter((movie: DiscoverCandidate) => !inList.has(movie.tmdbId) && movie.title !== '');

      for (const candidate of found.slice(0, MAX_CHECKS)) {
        const credits = await usage.track('tmdb', () => tmdb.getMovie(candidate.tmdbId));
        const director = credits.directors.find((person) => people.has(person.id));
        const actor = credits.cast.find((person) => people.has(person.id));
        const match = director ?? actor;
        const linked = match && people.get(match.id);
        if (!match || !linked) continue;

        const listFilm = director ? (linked.directed[0] ?? linked.acted[0]) : (linked.acted[0] ?? linked.directed[0]);
        const role = director ? `Direção de ${match.name}` : `Com ${match.name}`;
        return {
          type: 'daily.release',
          title: `${window.title}: ${candidate.title}`,
          body: `${role}, de ${listFilm}, que está na lista de vocês.`,
          route: { name: 'movie', args: { tmdbId: candidate.tmdbId } },
        };
      }
    }
  } catch (error) {
    logger.warn('notificação de estreia sem TMDb', { listId: list.listId, error });
  }
  return null;
}

/**
 * Pessoas que contam para a estreia: todo diretor de filme da lista e quem é recorrente no elenco,
 * as que aparecem em mais filmes primeiro.
 *
 * @param list - Lista lida pela rotina.
 * @returns As pessoas, por id, com os filmes da lista de cada uma.
 */
function linkedPeople(list: DailyContext['list']): Map<number, LinkedPerson> {
  const people = recurrentPeople(list);
  for (const entry of list.entries) {
    for (const director of list.movies.get(entry.tmdbId)?.directors ?? []) {
      const known = people.get(director.id);
      if (!known) people.set(director.id, { personId: director.id, directed: [entry.movie.title], acted: [] });
      else if (!known.directed.includes(entry.movie.title)) known.directed.push(entry.movie.title);
    }
  }
  const weight = (person: LinkedPerson) => person.directed.length + person.acted.length;
  return new Map([...people.entries()].sort(([, a], [, b]) => weight(b) - weight(a)));
}

export { composeRelease };

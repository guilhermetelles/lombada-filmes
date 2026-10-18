import type { DiscoverCandidate } from '../discover/tmdb-discover-client.js';
import { SourceUnavailableError } from '../errors/app-errors.js';
import { logger } from '../logging/logger.js';
import { runInBatches } from '../maintenance/run-in-batches.js';
import { fetchMovieFeatures } from '../movies/fetch-movie-features.js';
import { findMovies } from '../movies/movie-repository.js';
import { findPerson } from '../people/person-repository.js';
import { brazilDay } from '../time/brazil-day.js';
import { DAY_MS } from '../time/durations.js';
import type { Movie } from '../types/movie.js';
import type { RecSource } from '../types/recs.js';
import type { TmdbCollectionPart } from '../types/sources.js';
import type { RecsRun } from './recs-run.js';
import type { ListFilm } from './score-recs.js';

/** Quantos filmes do topo da lista dão as recomendações do TMDb. */
export const SEED_TOP_FILMS = 25;

/** Em quantos filmes da lista um diretor precisa estar para a filmografia dele entrar. */
const RECURRING_DIRECTOR_FILMS = 2;

/** Peso de um filme da filmografia de um diretor recorrente, perto do de uma recomendação do topo. */
const DIRECTOR_WEIGHT = 0.8;

/** De quantas sagas começadas pela lista buscar o próximo filme (as dos filmes mais altos primeiro). */
const MAX_SAGAS = 10;

/** Quantos dias para trás contam como "em cartaz". */
const NOW_PLAYING_DAYS = 40;

/** Um filme em alta ou em cartaz, com a origem. */
export type TrendingCandidate = { candidate: DiscoverCandidate; source: Extract<RecSource, 'trending' | 'nowPlaying'> };

/**
 * Garante o documento dos filmes do topo da lista que ainda não têm as recomendações do TMDb
 * (`recs`), buscando só no TMDb (fetchMovieFeatures), dentro do limite da execução.
 *
 * @param run - Execução.
 * @param films - Filmes da lista, do topo para baixo.
 * @param movies - Documentos já lidos, por id; recebe os buscados.
 */
export async function completeSeedMovies(
  run: RecsRun,
  films: readonly ListFilm[],
  movies: Map<number, Movie>,
): Promise<void> {
  const missing = films
    .slice(0, SEED_TOP_FILMS)
    .map((film) => film.tmdbId)
    .filter((tmdbId) => movies.get(tmdbId)?.recs === undefined);
  const fetched = await fetchMovies(run, missing, movies);
  for (const [tmdbId, movie] of fetched) movies.set(tmdbId, movie);
}

/**
 * Escolhe os candidatos da lista: o próximo filme de cada saga começada pela lista (na frente dos
 * outros), as recomendações do TMDb dos 25 primeiros (pesando mais as do topo e as primeiras de
 * cada filme) e a filmografia dos diretores que aparecem em 2 ou mais filmes da lista (das fichas
 * já guardadas em people/). Tira os excluídos (lista, fila e "Não quero") e fica com os de maior
 * peso, até o limite de candidatos da execução.
 *
 * @param run - Execução (banco e limites).
 * @param films - Filmes da lista, do topo para baixo.
 * @param movies - Documentos dos filmes da lista, por id.
 * @param excluded - Ids que não podem ser sugeridos.
 * @returns Os ids dos candidatos, do maior peso para o menor.
 */
export async function chooseCandidateIds(
  run: RecsRun,
  films: readonly ListFilm[],
  movies: ReadonlyMap<number, Movie>,
  excluded: ReadonlySet<number>,
): Promise<number[]> {
  const weights = new Map<number, number>();
  const add = (tmdbId: number, weight: number) => {
    if (!excluded.has(tmdbId)) weights.set(tmdbId, (weights.get(tmdbId) ?? 0) + weight);
  };
  const quality = (position: number) => (films.length <= 1 ? 1 : 1 - (position - 1) / films.length);

  for (const film of films.slice(0, SEED_TOP_FILMS)) {
    const recs = movies.get(film.tmdbId)?.recs ?? [];
    recs.forEach((tmdbId, rank) => {
      add(tmdbId, quality(film.position) * (1 - rank / (2 * recs.length)));
    });
  }

  for (const { personId, bestPosition } of recurringDirectors(films, movies)) {
    let directed: { tmdbId: number }[] = [];
    try {
      directed = (await findPerson(run.dependencies.db, personId))?.directed ?? [];
    } catch (error) {
      logger.warn('ficha de diretor fora do formato, sem filmografia', { personId, error });
    }
    for (const { tmdbId } of directed) add(tmdbId, DIRECTOR_WEIGHT * quality(bestPosition));
  }

  const sagaIds = await nextInSagas(run, films, movies, excluded);
  const weighted = [...weights]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([tmdbId]) => tmdbId)
    .filter((tmdbId) => !sagaIds.includes(tmdbId));
  return [...sagaIds, ...weighted].slice(0, run.limits.maxCandidates);
}

/**
 * Busca no TMDb (/collection/{id}) as sagas começadas pela lista, das dos filmes mais altos para
 * as dos mais baixos (até 10), e fica com o próximo filme de cada uma, enquanto houver tempo e
 * pedidos na execução. Saga que o TMDb não devolve fica de fora (registrado no log).
 *
 * @param run - Execução.
 * @param films - Filmes da lista, do topo para baixo.
 * @param movies - Documentos dos filmes da lista, por id.
 * @param excluded - Ids que não podem ser sugeridos (lista, fila e "Não quero").
 * @returns Um id por saga, na ordem das sagas.
 */
async function nextInSagas(
  run: RecsRun,
  films: readonly ListFilm[],
  movies: ReadonlyMap<number, Movie>,
  excluded: ReadonlySet<number>,
): Promise<number[]> {
  const collectionIds = [...new Set(films.flatMap((film) => movies.get(film.tmdbId)?.collection?.id ?? []))].slice(
    0,
    MAX_SAGAS,
  );
  const watched = new Set(films.map((film) => film.tmdbId));
  const today = brazilDay(run.startedAt);
  const picks: number[] = [];

  for (const collectionId of collectionIds) {
    if (!run.canFetch()) break;
    try {
      const { tmdb } = run.dependencies.sources;
      const collection = await run.usage.track('tmdb', () => tmdb.getCollection(collectionId));
      const next = nextUnwatchedPart(collection.parts, watched, today);
      if (next !== null && !excluded.has(next) && !picks.includes(next)) picks.push(next);
    } catch (error) {
      logger.warn('saga indisponível no TMDb, fora das sugestões', { collectionId, error });
    }
  }
  return picks;
}

/**
 * Próximo filme de uma saga: o primeiro, por data de estreia, que já estreou e não está na lista.
 *
 * @param parts - Filmes da saga.
 * @param watched - Ids dos filmes da lista.
 * @param today - Hoje, AAAA-MM-DD (Brasília).
 * @returns O id do filme, ou null se a lista já tem todos os lançados.
 */
export function nextUnwatchedPart(
  parts: readonly TmdbCollectionPart[],
  watched: ReadonlySet<number>,
  today: string,
): number | null {
  const released = parts
    .flatMap((part) => (part.release !== null && part.release <= today ? [{ ...part, release: part.release }] : []))
    .sort((a, b) => a.release.localeCompare(b.release) || a.tmdbId - b.tmdbId);
  return released.find((part) => !watched.has(part.tmdbId))?.tmdbId ?? null;
}

/**
 * Lê os documentos dos filmes pedidos, buscando no TMDb (fetchMovieFeatures, nunca OMDb nem
 * Letterboxd) enquanto houver tempo e pedidos; depois disso, ou se a busca falhar, fica o que já
 * estava guardado.
 *
 * @param run - Execução.
 * @param tmdbIds - Filmes.
 * @param known - Documentos já lidos, para não ler de novo.
 * @returns Os documentos conseguidos, por id.
 */
export async function fetchMovies(
  run: RecsRun,
  tmdbIds: readonly number[],
  known: ReadonlyMap<number, Movie> = new Map(),
): Promise<Map<number, Movie>> {
  const found = new Map<number, Movie>();
  if (tmdbIds.length === 0) return found;
  const unknown = tmdbIds.filter((tmdbId) => !known.has(tmdbId));
  const stored = new Map([...known, ...(await findMovies(run.dependencies.db, unknown))]);

  await runInBatches([...tmdbIds], run.limits.batchSize, async (tmdbId) => {
    const fallback = stored.get(tmdbId);
    if (!run.canFetch()) {
      if (fallback) found.set(tmdbId, fallback);
      return;
    }
    try {
      found.set(tmdbId, await fetchMovieFeatures(tmdbId, run.dependencies, run.usage));
    } catch (error) {
      logger.warn('filme indisponível no TMDb, fora das sugestões', { tmdbId, error });
      if (fallback) found.set(tmdbId, fallback);
    }
  });
  return found;
}

/**
 * Busca os filmes em alta na semana e os em cartaz no Brasil (lançados nos últimos 40 dias nos
 * cinemas daqui), sem os excluídos. Uma falha de uma das listas deixa só a outra.
 *
 * @param run - Execução.
 * @param excluded - Ids que não podem ser sugeridos.
 * @returns Os filmes, os em alta primeiro, sem repetição.
 */
export async function gatherTrending(run: RecsRun, excluded: ReadonlySet<number>): Promise<TrendingCandidate[]> {
  const { tmdbDiscover } = run.dependencies.sources;
  const [trending, nowPlaying] = await Promise.all([
    readOrEmpty(() => run.usage.track('tmdb', () => tmdbDiscover.trendingWeek())),
    readOrEmpty(
      async () => (await run.usage.track('tmdb', () => tmdbDiscover.discover(nowPlayingParams(run.startedAt)))).results,
    ),
  ]);
  const seen = new Set<number>();
  const result: TrendingCandidate[] = [];
  const push = (candidate: DiscoverCandidate, source: TrendingCandidate['source']) => {
    if (excluded.has(candidate.tmdbId) || seen.has(candidate.tmdbId)) return;
    seen.add(candidate.tmdbId);
    result.push({ candidate, source });
  };
  for (const candidate of trending) push(candidate, 'trending');
  for (const candidate of nowPlaying) push(candidate, 'nowPlaying');
  return result;
}

/**
 * Parâmetros do /discover/movie para os filmes em cartaz no Brasil: lançamento nos cinemas daqui
 * (tipos 2 e 3) nos últimos 40 dias, dos mais populares para os menos.
 *
 * @param now - Momento da execução.
 * @returns Os parâmetros.
 */
export function nowPlayingParams(now: Date): URLSearchParams {
  return new URLSearchParams({
    language: 'pt-BR',
    region: 'BR',
    watch_region: 'BR',
    with_release_type: '2|3',
    'release_date.gte': brazilDay(new Date(now.getTime() - NOW_PLAYING_DAYS * DAY_MS)),
    'release_date.lte': brazilDay(now),
    sort_by: 'popularity.desc',
    include_adult: 'false',
    page: '1',
  });
}

/**
 * Diretores que aparecem em 2 ou mais filmes da lista, com a melhor posição entre eles.
 *
 * @param films - Filmes da lista.
 * @param movies - Documentos, por id.
 * @returns Os diretores recorrentes.
 */
function recurringDirectors(
  films: readonly ListFilm[],
  movies: ReadonlyMap<number, Movie>,
): { personId: number; bestPosition: number }[] {
  const seen = new Map<number, { count: number; bestPosition: number }>();
  for (const film of films) {
    for (const director of movies.get(film.tmdbId)?.directors ?? []) {
      const current = seen.get(director.id);
      seen.set(director.id, {
        count: (current?.count ?? 0) + 1,
        bestPosition: Math.min(current?.bestPosition ?? film.position, film.position),
      });
    }
  }
  return [...seen]
    .filter(([, { count }]) => count >= RECURRING_DIRECTOR_FILMS)
    .map(([personId, { bestPosition }]) => ({ personId, bestPosition }));
}

/**
 * Lê uma lista do TMDb; se o TMDb estiver fora, devolve vazio (registrado no log).
 *
 * @param read - Leitura.
 * @returns Os filmes, ou vazio.
 */
async function readOrEmpty(read: () => Promise<DiscoverCandidate[]>): Promise<DiscoverCandidate[]> {
  try {
    return await read();
  } catch (error) {
    if (!(error instanceof SourceUnavailableError)) throw error;
    logger.warn('lista do TMDb indisponível, seguindo sem ela', { error: error.message });
    return [];
  }
}

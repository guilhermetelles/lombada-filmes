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

/** Quantos filmes da fila "Quero ver" (os mais recentes) dão as recomendações do TMDb. */
export const SEED_QUEUE_FILMS = 15;

/** Peso de uma recomendação de um filme da fila, abaixo das do topo da lista. */
const QUEUE_WEIGHT = 0.7;

/** Peso de um filme achado pela palavra-chave de maior peso no modelo. */
const KEYWORD_WEIGHT = 0.6;

/** Vagas guardadas para os candidatos vindos da fila, para não perderem para as recomendações do topo. */
const QUEUE_SLOTS = 15;

/** Vagas guardadas para os candidatos vindos das palavras-chave. */
const KEYWORD_SLOTS = 15;

/** Quantos dias para trás contam como "em cartaz". */
const NOW_PLAYING_DAYS = 40;

/** De que fonte veio um candidato. */
export type CandidateSource = 'saga' | 'list' | 'director' | 'queue' | 'keyword';

/** Filmes achados por uma palavra-chave do modelo, do mais popular para o menos. */
export type KeywordSeed = { keywordId: number; weight: number; tmdbIds: number[] }; // weight: 0 a 1, relativo à maior

/** O que dá candidatos além da lista: a fila e as palavras-chave. */
export type ExtraSeeds = { queued: readonly number[]; keywords: readonly KeywordSeed[] };

/** Candidatos escolhidos, com a origem de cada um e quantos vieram de cada fonte. */
export type ChosenCandidates = {
  ids: number[]; // da escolha mais forte para a mais fraca
  origins: Map<number, string>; // grupo da origem de maior peso, como `origin:seed:603`
  sources: Record<CandidateSource, number>;
};

/** Um filme em alta ou em cartaz, com a origem. */
export type TrendingCandidate = { candidate: DiscoverCandidate; source: Extract<RecSource, 'trending' | 'nowPlaying'> };

/**
 * Garante o documento dos filmes do topo da lista e dos mais recentes da fila que ainda não têm as
 * recomendações do TMDb (`recs`), buscando só no TMDb (fetchMovieFeatures), dentro do limite da
 * execução (os da lista primeiro).
 *
 * @param run - Execução.
 * @param films - Filmes da lista, do topo para baixo.
 * @param queued - Filmes da fila, do mais recente para o mais antigo.
 * @param movies - Documentos já lidos, por id; recebe os buscados.
 */
export async function completeSeedMovies(
  run: RecsRun,
  films: readonly ListFilm[],
  queued: readonly number[],
  movies: Map<number, Movie>,
): Promise<void> {
  const missing = [
    ...films.slice(0, SEED_TOP_FILMS).map((film) => film.tmdbId),
    ...queued.slice(0, SEED_QUEUE_FILMS),
  ].filter((tmdbId) => movies.get(tmdbId)?.recs === undefined);
  const fetched = await fetchMovies(run, missing, movies);
  for (const [tmdbId, movie] of fetched) movies.set(tmdbId, movie);
}

/**
 * Escolhe os candidatos da lista. Fontes: o próximo filme de cada saga começada pela lista, as
 * recomendações do TMDb dos 25 primeiros (pesando mais as do topo e as primeiras de cada filme), a
 * filmografia dos diretores que aparecem em 2 ou mais filmes da lista (das fichas já guardadas em
 * people/), as recomendações dos 15 mais recentes da fila e os filmes das palavras-chave do modelo.
 * O peso de um candidato é a soma do que cada fonte dá a ele. Corte: as sagas na frente, depois até
 * 15 vagas para os da fila e 15 para os das palavras-chave (os de maior peso dentro de cada uma,
 * para as recomendações do topo não tomarem tudo), e o resto pelo peso, até o limite de candidatos
 * da execução. Tira os excluídos (lista, fila e "Não quero").
 *
 * @param run - Execução (banco e limites).
 * @param films - Filmes da lista, do topo para baixo.
 * @param movies - Documentos dos filmes da lista e da fila, por id.
 * @param excluded - Ids que não podem ser sugeridos.
 * @param extra - Fila e filmes das palavras-chave.
 * @returns Os candidatos, a origem de cada um e quantos vieram de cada fonte.
 */
export async function chooseCandidateIds(
  run: RecsRun,
  films: readonly ListFilm[],
  movies: ReadonlyMap<number, Movie>,
  excluded: ReadonlySet<number>,
  extra: ExtraSeeds = { queued: [], keywords: [] },
): Promise<ChosenCandidates> {
  const weights = new Map<number, number>();
  const bySource = new Map<CandidateSource, Map<number, number>>();
  const best = new Map<number, { weight: number; origin: string; source: CandidateSource }>();
  const add = (tmdbId: number, weight: number, source: CandidateSource, origin: string) => {
    if (excluded.has(tmdbId)) return;
    weights.set(tmdbId, (weights.get(tmdbId) ?? 0) + weight);
    const sourceWeights = bySource.get(source) ?? new Map<number, number>();
    sourceWeights.set(tmdbId, (sourceWeights.get(tmdbId) ?? 0) + weight);
    bySource.set(source, sourceWeights);
    const current = best.get(tmdbId);
    if (!current || weight > current.weight) best.set(tmdbId, { weight, origin, source });
  };
  const quality = (position: number) => (films.length <= 1 ? 1 : 1 - (position - 1) / films.length);
  const addRecs = (seedId: number, factor: number, source: CandidateSource, origin: string) => {
    const recs = movies.get(seedId)?.recs ?? [];
    recs.forEach((tmdbId, rank) => {
      add(tmdbId, factor * (1 - rank / (2 * recs.length)), source, origin);
    });
  };

  for (const film of films.slice(0, SEED_TOP_FILMS)) {
    addRecs(film.tmdbId, quality(film.position), 'list', `origin:seed:${film.tmdbId}`);
  }
  for (const tmdbId of extra.queued.slice(0, SEED_QUEUE_FILMS)) {
    addRecs(tmdbId, QUEUE_WEIGHT, 'queue', `origin:queue:${tmdbId}`);
  }
  for (const { keywordId, weight, tmdbIds } of extra.keywords) {
    tmdbIds.forEach((tmdbId, rank) => {
      add(
        tmdbId,
        KEYWORD_WEIGHT * weight * (1 - rank / (2 * tmdbIds.length)),
        'keyword',
        `origin:keyword:${keywordId}`,
      );
    });
  }

  for (const { personId, bestPosition } of recurringDirectors(films, movies)) {
    let directed: { tmdbId: number }[] = [];
    try {
      directed = (await findPerson(run.dependencies.db, personId))?.directed ?? [];
    } catch (error) {
      logger.warn('ficha de diretor fora do formato, sem filmografia', { personId, error });
    }
    for (const { tmdbId } of directed) {
      add(tmdbId, DIRECTOR_WEIGHT * quality(bestPosition), 'director', `origin:director:${personId}`);
    }
  }

  const chosen: ChosenCandidates = {
    ids: [],
    origins: new Map(),
    sources: { saga: 0, list: 0, director: 0, queue: 0, keyword: 0 },
  };
  const take = (tmdbId: number, origin: string, source: CandidateSource) => {
    if (chosen.ids.length >= run.limits.maxCandidates || chosen.origins.has(tmdbId)) return;
    chosen.ids.push(tmdbId);
    chosen.origins.set(tmdbId, origin);
    chosen.sources[source] += 1;
  };
  const strongest = (map: ReadonlyMap<number, number> | undefined) =>
    [...(map ?? [])].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([tmdbId]) => tmdbId);
  const takeBest = (tmdbId: number, fallback?: CandidateSource) => {
    const origin = best.get(tmdbId);
    if (origin) take(tmdbId, origin.origin, fallback ?? origin.source);
  };

  for (const { tmdbId, collectionId } of await nextInSagas(run, films, movies, excluded)) {
    take(tmdbId, `origin:saga:${collectionId}`, 'saga');
  }
  for (const tmdbId of strongest(bySource.get('queue')).slice(0, QUEUE_SLOTS)) takeBest(tmdbId, 'queue');
  for (const tmdbId of strongest(bySource.get('keyword')).slice(0, KEYWORD_SLOTS)) takeBest(tmdbId, 'keyword');
  for (const tmdbId of strongest(weights)) takeBest(tmdbId);
  return chosen;
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
 * @returns Um filme por saga, com o id da saga, na ordem das sagas.
 */
async function nextInSagas(
  run: RecsRun,
  films: readonly ListFilm[],
  movies: ReadonlyMap<number, Movie>,
  excluded: ReadonlySet<number>,
): Promise<{ tmdbId: number; collectionId: number }[]> {
  const collectionIds = [...new Set(films.flatMap((film) => movies.get(film.tmdbId)?.collection?.id ?? []))].slice(
    0,
    MAX_SAGAS,
  );
  const watched = new Set(films.map((film) => film.tmdbId));
  const today = brazilDay(run.startedAt);
  const picks: { tmdbId: number; collectionId: number }[] = [];

  for (const collectionId of collectionIds) {
    if (!run.canFetch()) break;
    try {
      const { tmdb } = run.dependencies.sources;
      const collection = await run.usage.track('tmdb', () => tmdb.getCollection(collectionId));
      const next = nextUnwatchedPart(collection.parts, watched, today);
      if (next !== null && !excluded.has(next) && !picks.some((pick) => pick.tmdbId === next)) {
        picks.push({ tmdbId: next, collectionId });
      }
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
export async function readOrEmpty(read: () => Promise<DiscoverCandidate[]>): Promise<DiscoverCandidate[]> {
  try {
    return await read();
  } catch (error) {
    if (!(error instanceof SourceUnavailableError)) throw error;
    logger.warn('lista do TMDb indisponível, seguindo sem ela', { error: error.message });
    return [];
  }
}

import type { Firestore } from 'firebase-admin/firestore';
import { SourceUnavailableError } from '../errors/app-errors.js';
import { logger } from '../logging/logger.js';
import type { DiscoverItem, DiscoverPage, DiscoverSort, Filters } from '../types/discover.js';
import type { RecsModel } from '../types/recs.js';
import type { TmdbLanguage } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import { buildDiscoverParams } from './build-discover-params.js';
import { findEntryIdsByTmdbIds, readRecsModel, readTopGenres } from './discover-repository.js';
import { orderResults } from './order-results.js';
import {
  buildGenreTaste,
  type Compat,
  candidateFeatures,
  candidateGenres,
  scoreByGenreTaste,
  scoreByTmdbVote,
  scoreWithModel,
} from './score-candidates.js';
import type { CandidateExtras, DiscoverCandidate, TmdbDiscoverClient } from './tmdb-discover-client.js';

/** Compatibilidade mínima para "Só o que combina com vocês". */
export const FIT_MIN_SCORE = 60;

/** O que a busca usa de fora. */
type DiscoverDependencies = { db: Firestore; tmdb: TmdbDiscoverClient; usage: UsageRecorder };

/**
 * Pedido da busca: filtros, página, ordem, idioma dos títulos e, se houver, a lista (já conferido
 * que a pessoa é membro).
 */
type DiscoverRequest = {
  filters: Filters;
  page: number;
  sort?: DiscoverSort | undefined;
  listId?: string | undefined;
  language?: TmdbLanguage;
};

/** Como pontuar os filmes desta busca. */
type Scorer = (candidate: DiscoverCandidate, extras?: CandidateExtras) => Compat;

/**
 * Busca avançada: uma página do /discover/movie do TMDb (região BR) com os filtros, pontuada pela
 * compatibilidade com a lista. Com o modelo de recs/current, a nota vem dos pesos aplicados às
 * variáveis do filme (gêneros, ano, nota, popularidade e palavras-chave); sem modelo, dos gêneros
 * mais frequentes nos 20 primeiros da lista; sem lista, da nota do TMDb. Todos os filmes da página
 * ganham detalhes (duração, streaming e palavras-chave), para serem pontuados do mesmo jeito. A
 * ordem é a de orderResults: palavras da frase primeiro e, depois, a mistura da posição no TMDb com
 * a compatibilidade (`relevance`, o padrão) ou só a compatibilidade (`compat`). Marca os filmes em
 * alta na semana e os que já estão na lista. Falha nos filmes em alta ou nos detalhes não derruba a
 * busca: o filme só fica sem a marca ou sem os detalhes.
 *
 * @param dependencies - Banco, cliente do TMDb e medidor de consumo.
 * @param request - Filtros, página, ordem, lista e idioma dos títulos (en-US com `lang=en`).
 * @returns A página de resultados.
 * @throws {SourceUnavailableError} Se o /discover do TMDb falhar.
 */
async function discoverMovies(
  { db, tmdb, usage }: DiscoverDependencies,
  { filters, page, sort = 'relevance', listId, language = 'pt-BR' }: DiscoverRequest,
): Promise<DiscoverPage> {
  const plan = buildDiscoverParams(filters, page, language);
  const [found, trendingIds, scorer] = await Promise.all([
    usage.track('tmdb', () => tmdb.discover(plan.params)),
    readTrendingIds(tmdb, usage),
    listId ? listScorer(db, listId) : Promise.resolve<Scorer>((candidate) => scoreByTmdbVote(candidate, false)),
  ]);

  const candidates = found.results.filter((candidate) =>
    plan.requiredGenreGroups.every((group) => group.some((id) => candidate.genreIds.includes(id))),
  );
  const [entryIds, extras] = await Promise.all([
    listId
      ? findEntryIdsByTmdbIds(
          db,
          listId,
          candidates.map((candidate) => candidate.tmdbId),
        )
      : Promise.resolve(new Map<number, string>()),
    readExtras(
      tmdb,
      usage,
      candidates.map((candidate) => candidate.tmdbId),
    ),
  ]);

  const keywordIds = filters.kw ?? [];
  const matchesOf = (tmdbId: number) => {
    const ids = extras.get(tmdbId)?.keywordIds ?? [];
    return keywordIds.filter((id) => ids.includes(id));
  };
  // O filtro de duração do TMDb deixa passar filmes que, nos detalhes, ficam fora da faixa.
  const { min, max } = plan.runtimeRange;
  let scored = found.results.flatMap((candidate, tmdbIndex) => {
    if (!candidates.includes(candidate)) return [];
    const detail = extras.get(candidate.tmdbId);
    const runtime = detail?.runtime;
    if (runtime && ((min !== null && runtime < min) || (max !== null && runtime > max))) return [];
    const compat = scorer(candidate, detail);
    return [{ candidate, compat, tmdbIndex, score: compat.score, matches: matchesOf(candidate.tmdbId).length }];
  });
  if (filters.fit && listId) scored = scored.filter(({ compat }) => compat.score >= FIT_MIN_SCORE);

  const results = orderResults(scored, sort, found.results.length).map(({ candidate, compat }): DiscoverItem => {
    const detail = extras.get(candidate.tmdbId);
    return {
      tmdbId: candidate.tmdbId,
      title: candidate.title,
      year: candidate.year,
      posterPath: candidate.posterPath,
      runtime: detail?.runtime ?? null,
      genres: candidateGenres(candidate),
      providers: detail?.providers ?? [],
      score: compat.score,
      reason: compat.reason,
      trending: trendingIds.has(candidate.tmdbId),
      inListEntryId: entryIds.get(candidate.tmdbId) ?? null,
      matchedKeywords: matchesOf(candidate.tmdbId),
    };
  });
  return { results, page: found.page, totalPages: found.totalPages };
}

/**
 * Monta o pontuador da lista: o modelo de recs/current quando houver; senão, os gêneros dos 20
 * primeiros; com a lista vazia, a nota do TMDb.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @returns O pontuador.
 */
async function listScorer(db: Firestore, listId: string): Promise<Scorer> {
  const model: RecsModel | undefined = await readRecsModel(db, listId);
  if (model) return (candidate, extras) => scoreWithModel(model, candidateFeatures(candidate, extras));

  const taste = buildGenreTaste(await readTopGenres(db, listId));
  if (taste.size === 0) return (candidate) => scoreByTmdbVote(candidate, true);
  return (candidate) => scoreByGenreTaste(taste, candidateGenres(candidate));
}

/**
 * Ids dos filmes em alta na semana, buscados uma vez por pedido. Uma falha vira conjunto vazio.
 *
 * @param tmdb - Cliente do TMDb.
 * @param usage - Medidor de consumo.
 * @returns Os ids em alta.
 */
async function readTrendingIds(tmdb: TmdbDiscoverClient, usage: UsageRecorder): Promise<Set<number>> {
  try {
    const trending = await usage.track('tmdb', () => tmdb.trendingWeek());
    return new Set(trending.map((movie) => movie.tmdbId));
  } catch (error) {
    if (!(error instanceof SourceUnavailableError)) throw error;
    logger.warn('filmes em alta indisponíveis; busca segue sem a marca', { error });
    return new Set();
  }
}

/**
 * Busca os detalhes dos filmes em paralelo. Filme cujo pedido falhar fica sem detalhes.
 *
 * @param tmdb - Cliente do TMDb.
 * @param usage - Medidor de consumo.
 * @param tmdbIds - Filmes.
 * @returns Os detalhes de cada filme que deu certo.
 */
async function readExtras(
  tmdb: TmdbDiscoverClient,
  usage: UsageRecorder,
  tmdbIds: readonly number[],
): Promise<Map<number, CandidateExtras>> {
  const settled = await Promise.allSettled(
    tmdbIds.map((tmdbId) => usage.track('tmdb', () => tmdb.movieExtras(tmdbId))),
  );
  const extras = new Map<number, CandidateExtras>();
  settled.forEach((result, index) => {
    const tmdbId = tmdbIds[index];
    if (result.status === 'fulfilled' && tmdbId !== undefined) extras.set(tmdbId, result.value);
    else if (result.status === 'rejected')
      logger.warn('detalhes do filme indisponíveis', { tmdbId, error: result.reason });
  });
  return extras;
}

export { discoverMovies };

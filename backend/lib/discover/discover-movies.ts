import type { Firestore } from 'firebase-admin/firestore';
import { SourceUnavailableError } from '../errors/app-errors.js';
import { logger } from '../logging/logger.js';
import type { DiscoverItem, DiscoverPage, Filters } from '../types/discover.js';
import type { RecsModel } from '../types/recs.js';
import type { TmdbLanguage } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import { buildDiscoverParams } from './build-discover-params.js';
import { findEntryIdsByTmdbIds, readRecsModel, readTopGenres } from './discover-repository.js';
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

/** Quantos dos primeiros resultados ganham detalhes (duração, streaming e palavras-chave). */
export const DETAILED_RESULTS = 10;

/** Com palavras-chave do texto, mais resultados ganham detalhes, para a ordem por palavras valer. */
export const DETAILED_RESULTS_WITH_KEYWORDS = 20;

/** Compatibilidade mínima para "Só o que combina com vocês". */
export const FIT_MIN_SCORE = 60;

/** O que a busca usa de fora. */
type DiscoverDependencies = { db: Firestore; tmdb: TmdbDiscoverClient; usage: UsageRecorder };

/** Pedido da busca: filtros, página, idioma dos títulos e, se houver, a lista (já conferido que a pessoa é membro). */
type DiscoverRequest = { filters: Filters; page: number; listId?: string | undefined; language?: TmdbLanguage };

/** Como pontuar os filmes desta busca. */
type Scorer = (candidate: DiscoverCandidate, extras?: CandidateExtras) => Compat;

/**
 * Busca avançada: uma página do /discover/movie do TMDb (região BR) com os filtros, pontuada pela
 * compatibilidade com a lista e ordenada por ela. Com o modelo de recs/current, a nota vem dos pesos
 * aplicados às variáveis que o /discover traz (gêneros, ano, nota, popularidade; palavras-chave nos
 * 10 primeiros); sem modelo, dos gêneros mais frequentes nos 20 primeiros da lista; sem lista, da
 * nota do TMDb. Marca os filmes em alta na semana e os que já estão na lista. Falha nos filmes em
 * alta ou nos detalhes não derruba a busca: o filme só fica sem a marca ou sem os detalhes.
 *
 * @param dependencies - Banco, cliente do TMDb e medidor de consumo.
 * @param request - Filtros, página, lista e idioma dos títulos (en-US com `lang=en`).
 * @returns A página de resultados.
 * @throws {SourceUnavailableError} Se o /discover do TMDb falhar.
 */
async function discoverMovies(
  { db, tmdb, usage }: DiscoverDependencies,
  { filters, page, listId, language = 'pt-BR' }: DiscoverRequest,
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
  const entryIds = listId
    ? await findEntryIdsByTmdbIds(
        db,
        listId,
        candidates.map((candidate) => candidate.tmdbId),
      )
    : new Map<number, string>();

  let scored = sortByScore(candidates.map((candidate) => ({ candidate, compat: scorer(candidate) })));
  const keywordIds = filters.kw ?? [];
  const detailed = keywordIds.length > 0 ? DETAILED_RESULTS_WITH_KEYWORDS : DETAILED_RESULTS;
  const extras = await readExtras(
    tmdb,
    usage,
    scored.slice(0, detailed).map(({ candidate }) => candidate.tmdbId),
  );
  scored = sortByScore(
    scored.map(({ candidate, compat }) => {
      const detail = extras.get(candidate.tmdbId);
      return { candidate, compat: detail ? scorer(candidate, detail) : compat };
    }),
  );
  // O filtro de duração do TMDb deixa passar filmes que, nos detalhes, ficam fora da faixa.
  const { min, max } = plan.runtimeRange;
  scored = scored.filter(({ candidate }) => {
    const runtime = extras.get(candidate.tmdbId)?.runtime;
    return !runtime || ((min === null || runtime >= min) && (max === null || runtime <= max));
  });
  if (filters.fit && listId) scored = scored.filter(({ compat }) => compat.score >= FIT_MIN_SCORE);

  // Palavras do texto: quem tem mais delas vem antes; no empate, a compatibilidade decide.
  const matchesOf = (tmdbId: number) => {
    const ids = extras.get(tmdbId)?.keywordIds ?? [];
    return keywordIds.filter((id) => ids.includes(id));
  };
  if (keywordIds.length > 0) {
    scored = [...scored].sort(
      (a, b) =>
        matchesOf(b.candidate.tmdbId).length - matchesOf(a.candidate.tmdbId).length || b.compat.score - a.compat.score,
    );
  }

  const results = scored.map(({ candidate, compat }): DiscoverItem => {
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

/**
 * Ordena pela compatibilidade, da maior para a menor; no empate, mantém a ordem do TMDb.
 *
 * @param scored - Filmes pontuados.
 * @returns Uma cópia ordenada.
 */
function sortByScore<T extends { compat: Compat }>(scored: readonly T[]): T[] {
  return [...scored].sort((a, b) => b.compat.score - a.compat.score);
}

export { discoverMovies };

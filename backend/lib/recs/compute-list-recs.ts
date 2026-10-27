import { findMovies } from '../movies/movie-repository.js';
import { brazilDay } from '../time/brazil-day.js';
import type { List } from '../types/list.js';
import type { Movie } from '../types/movie.js';
import type { RecScore, RecsDoc } from '../types/recs.js';
import { byScore, diversify } from './diversify.js';
import { fallbackReason } from './fallback-reason.js';
import {
  type CandidateSource,
  chooseCandidateIds,
  completeSeedMovies,
  fetchMovies,
  gatherTrending,
} from './gather-candidates.js';
import { writeGeminiReasons } from './gemini-reasons.js';
import { keywordCandidates } from './keyword-candidates.js';
import { keywordLabels } from './keyword-labels.js';
import { movieFeatures } from './movie-features.js';
import { readListFeedback, readListFilms, recsDocument } from './recs-repository.js';
import type { RecsRun } from './recs-run.js';
import { splitByTurn } from './rotate.js';
import {
  buildListIndex,
  type ListFilm,
  type ListFilmWithMovie,
  type ListIndex,
  type ScoredRec,
  scoreCandidate,
  scoreMovie,
  toRecItem,
} from './score-recs.js';
import { type FittedModel, fitListModel, MODEL_VERSION } from './train-model.js';

/** Sugestões guardadas por lista. */
export const MAX_ITEMS = 30;

/** Filmes em alta guardados por lista. */
export const MAX_TRENDING = 15;

/** Quantos dos primeiros filmes em alta seguem a rotação. */
const TRENDING_ON_TURN = 5;

/** Quantos dispensados (os mais recentes) baixam a nota dos parecidos. */
const DISMISSED_FEEDBACK = 30;

/** O que aconteceu com uma lista na rotina. */
export type ListRecsReport = {
  listId: string;
  status: 'written' | 'empty';
  films: number;
  candidates: number;
  sources: Record<CandidateSource, number>; // quantos candidatos vieram de cada fonte
  keywords: string[]; // palavras-chave do modelo usadas como fonte
  items: number;
  trending: number;
  alpha: number | null; // peso do modelo aprendido na mistura com a nota do TMDb
  holdoutAccuracy: number | null;
  geminiReasons: number; // motivos escritos pelo Gemini (o resto é a reserva)
  reasonsFallback: string | null; // por que os motivos caíram para a reserva (falha do Gemini), ou null
};

/**
 * Calcula e grava lists/{listId}/recs/current: candidatos (recomendações do TMDb dos 25 primeiros e
 * da fila, filmografia de diretores recorrentes, palavras-chave do modelo, em alta e em cartaz),
 * variáveis só do TMDb, modelo de pares do ranking, vizinhos, ajuste pela fila e pelos dispensados,
 * rotação (só os filmes da vez entram em `items`; os outros ficam em `scores`), variedade e motivos
 * (Gemini num pedido só; reserva por variáveis). Lista sem filmes fica sem documento. Grava o
 * documento inteiro com set(): rodar de novo troca pelo cálculo novo, sem acumular.
 *
 * @param run - Execução.
 * @param listId - Lista.
 * @param list - Documento da lista (nomes dos membros, para tirar dos comentários).
 * @returns O relatório da lista.
 */
async function computeListRecs(run: RecsRun, listId: string, list: List): Promise<ListRecsReport> {
  const { db, sources } = run.dependencies;
  const films = await readListFilms(db, listId);
  const report: ListRecsReport = {
    listId,
    status: 'empty',
    films: films.length,
    candidates: 0,
    sources: { saga: 0, list: 0, director: 0, queue: 0, keyword: 0 },
    keywords: [],
    items: 0,
    trending: 0,
    alpha: null,
    holdoutAccuracy: null,
    geminiReasons: 0,
    reasonsFallback: null,
  };
  if (films.length === 0) return report;

  const feedback = await readListFeedback(db, listId);
  const dismissed = feedback.dismissed.slice(0, DISMISSED_FEEDBACK);
  const movies = await findMovies(db, [...films.map((film) => film.tmdbId), ...feedback.queued, ...dismissed]);
  await completeSeedMovies(run, films, feedback.queued, movies);
  const excluded = new Set([...feedback.queued, ...feedback.dismissed, ...films.map((film) => film.tmdbId)]);
  const index = buildListIndex(withMovies(films, movies), films.length, {
    queued: documentsOf(feedback.queued, movies),
    dismissed: documentsOf(dismissed, movies),
  });
  const fitted = fitFromIndex(index);
  // Rótulos em português das palavras-chave do modelo, para os motivos nunca citarem o nome em inglês.
  fitted.model = {
    ...fitted.model,
    labels: await keywordLabels(
      { db, gemini: sources.gemini, usage: run.usage, now: run.dependencies.now },
      Object.keys(fitted.model.weights).flatMap((feature) =>
        feature.startsWith('keyword:') ? [feature.slice('keyword:'.length)] : [],
      ),
    ),
  };

  const keywords = await keywordCandidates(run, fitted.model, fitted.alpha);
  const chosen = await chooseCandidateIds(run, films, movies, excluded, {
    queued: feedback.queued,
    keywords: keywords.seeds,
  });
  const candidateMovies = await fetchMovies(run, chosen.ids);
  const releasedYear = run.startedAt.getUTCFullYear();
  const scored = [...candidateMovies]
    .filter(([, movie]) => movie.year !== null && movie.year <= releasedYear)
    .map(([tmdbId, movie]) => {
      const rec = scoreMovie(fitted.model, index, tmdbId, movie, 'model');
      const origin = chosen.origins.get(tmdbId);
      return origin ? { ...rec, groups: [...rec.groups, origin] } : rec;
    });
  const today = brazilDay(run.startedAt);
  const { onTurn, offTurn } = splitByTurn(scored, today);
  const ordered = diversify(onTurn);
  const items = ordered.slice(0, MAX_ITEMS);

  const trending = await scoreTrending(
    run,
    fitted,
    index,
    new Set([...excluded, ...scored.map((rec) => rec.tmdbId)]),
    today,
  );

  const { reasons, failure } = await writeGeminiReasons(
    sources.gemini,
    run.usage,
    [...items, ...trending],
    index,
    memberNames(list),
  );
  const toItem = (rec: ScoredRec) => {
    const written = reasons.get(rec.tmdbId);
    return written
      ? toRecItem(rec, written, 'gemini')
      : toRecItem(rec, fallbackReason(rec, index, fitted.model), 'rules');
  };
  const scores: Record<string, RecScore> = {};
  for (const rec of [...ordered.slice(MAX_ITEMS), ...offTurn]) {
    scores[String(rec.tmdbId)] = { score: rec.score, reason: fallbackReason(rec, index, fitted.model) };
  }
  const doc: RecsDoc = {
    computedAt: run.dependencies.now(),
    modelVersion: MODEL_VERSION,
    model: fitted.model,
    items: items.map(toItem),
    trending: trending.map(toItem),
    scores,
  };
  await recsDocument(db, listId).set(doc);

  return {
    ...report,
    status: 'written',
    candidates: chosen.ids.length,
    sources: chosen.sources,
    keywords: keywords.names,
    items: doc.items.length,
    trending: doc.trending.length,
    alpha: fitted.alpha,
    holdoutAccuracy: fitted.holdoutAccuracy,
    geminiReasons: [...items, ...trending].filter((rec) => reasons.has(rec.tmdbId)).length,
    reasonsFallback: failure,
  };
}

/**
 * Ajusta o modelo com os filmes da lista que têm documento, na ordem do ranking.
 *
 * @param index - Índice da lista.
 * @returns O modelo ajustado.
 */
export function fitFromIndex(index: ListIndex): FittedModel {
  return fitListModel(index.films.map((film) => movieFeatures(film.movie)));
}

/**
 * Junta cada filme da lista ao seu documento; os sem documento ficam de fora.
 *
 * @param films - Filmes da lista.
 * @param movies - Documentos, por id.
 * @returns Os filmes com documento, na mesma ordem.
 */
export function withMovies(films: readonly ListFilm[], movies: ReadonlyMap<number, Movie>): ListFilmWithMovie[] {
  return films.flatMap((film) => {
    const movie = movies.get(film.tmdbId);
    return movie ? [{ ...film, movie }] : [];
  });
}

/**
 * Documentos dos filmes pedidos que já foram lidos, na mesma ordem; os sem documento ficam de fora.
 *
 * @param tmdbIds - Filmes.
 * @param movies - Documentos, por id.
 * @returns Os documentos.
 */
function documentsOf(tmdbIds: readonly number[], movies: ReadonlyMap<number, Movie>): Movie[] {
  return tmdbIds.flatMap((tmdbId) => movies.get(tmdbId) ?? []);
}

/**
 * Pontua os filmes em alta e em cartaz: primeiro pelo que a lista do TMDb traz, depois, nos 15
 * escolhidos, com o documento buscado no TMDb (duração, streaming, diretores e palavras-chave). Os 5
 * primeiros são os melhores da vez na rotação (completados pelos de fora, se faltarem); os outros 10,
 * os melhores que sobraram. Cada bloco fica da maior nota para a menor.
 *
 * @param run - Execução.
 * @param fitted - Modelo da lista.
 * @param index - Índice da lista.
 * @param excluded - Ids que não podem aparecer (lista, fila, "Não quero" e os candidatos da lista).
 * @param today - Dia AAAA-MM-DD (Brasília), para a rotação.
 * @returns Até 15 sugestões.
 */
async function scoreTrending(
  run: RecsRun,
  fitted: FittedModel,
  index: ListIndex,
  excluded: ReadonlySet<number>,
  today: string,
): Promise<ScoredRec[]> {
  const found = await gatherTrending(run, excluded);
  const quick = found.map(({ candidate, source }) => scoreCandidate(fitted.model, candidate, source));
  const first = splitByTurn(quick, today, TRENDING_ON_TURN).onTurn.slice(0, TRENDING_ON_TURN);
  const firstIds = new Set(first.map((rec) => rec.tmdbId));
  const rest = byScore(quick.filter((rec) => !firstIds.has(rec.tmdbId))).slice(0, MAX_TRENDING - first.length);
  const movies = await fetchMovies(
    run,
    [...first, ...rest].map((rec) => rec.tmdbId),
  );
  const rescore = (recs: readonly ScoredRec[]) =>
    byScore(
      recs.map((rec) => {
        const movie = movies.get(rec.tmdbId);
        if (!movie) return rec;
        return { ...scoreMovie(fitted.model, index, rec.tmdbId, movie, rec.source), candidate: rec.candidate };
      }),
    );
  return [...rescore(first), ...rescore(rest)];
}

/**
 * Nomes dos membros (e cada parte deles), para tirar dos comentários antes de mandar ao Gemini.
 *
 * @param list - Documento da lista.
 * @returns Os nomes.
 */
function memberNames(list: List): string[] {
  return Object.values(list.memberProfiles ?? {}).map((profile) => profile.name);
}

export { computeListRecs };

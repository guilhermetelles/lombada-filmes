import { findMovies } from '../movies/movie-repository.js';
import type { List } from '../types/list.js';
import type { Movie } from '../types/movie.js';
import type { RecsDoc } from '../types/recs.js';
import { diversify } from './diversify.js';
import { fallbackReason } from './fallback-reason.js';
import { chooseCandidateIds, completeSeedMovies, fetchMovies, gatherTrending } from './gather-candidates.js';
import { writeGeminiReasons } from './gemini-reasons.js';
import { keywordLabels } from './keyword-labels.js';
import { movieFeatures } from './movie-features.js';
import { readExcludedMovieIds, readListFilms, recsDocument } from './recs-repository.js';
import type { RecsRun } from './recs-run.js';
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

/** O que aconteceu com uma lista na rotina. */
export type ListRecsReport = {
  listId: string;
  status: 'written' | 'empty';
  films: number;
  candidates: number;
  items: number;
  trending: number;
  alpha: number | null; // peso do modelo aprendido na mistura com a nota do TMDb
  holdoutAccuracy: number | null;
  geminiReasons: number; // motivos escritos pelo Gemini (o resto é a reserva)
};

/**
 * Calcula e grava lists/{listId}/recs/current: candidatos (recomendações do TMDb dos 25 primeiros,
 * filmografia de diretores recorrentes, em alta e em cartaz), variáveis só do TMDb, modelo de
 * pares do ranking, vizinhos, variedade e motivos (Gemini num pedido só; reserva por variáveis).
 * Lista sem filmes fica sem documento. Grava o documento inteiro com set(): rodar de novo troca
 * pelo cálculo novo, sem acumular.
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
    items: 0,
    trending: 0,
    alpha: null,
    holdoutAccuracy: null,
    geminiReasons: 0,
  };
  if (films.length === 0) return report;

  const listMovies = await findMovies(
    db,
    films.map((film) => film.tmdbId),
  );
  await completeSeedMovies(run, films, listMovies);
  const excluded = new Set([...(await readExcludedMovieIds(db, listId)), ...films.map((film) => film.tmdbId)]);
  const index = buildListIndex(withMovies(films, listMovies), films.length);
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

  const candidateIds = await chooseCandidateIds(run, films, listMovies, excluded);
  const candidateMovies = await fetchMovies(run, candidateIds);
  const releasedYear = run.startedAt.getUTCFullYear();
  const scored = [...candidateMovies]
    .filter(([, movie]) => movie.year !== null && movie.year <= releasedYear)
    .map(([tmdbId, movie]) => scoreMovie(fitted.model, index, tmdbId, movie, 'model'));
  const items = diversify(scored).slice(0, MAX_ITEMS);

  const trending = await scoreTrending(run, fitted, index, excluded, new Set(items.map((item) => item.tmdbId)));

  const reasons = await writeGeminiReasons(
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
  const doc: RecsDoc = {
    computedAt: run.dependencies.now(),
    modelVersion: MODEL_VERSION,
    model: fitted.model,
    items: items.map(toItem),
    trending: trending.map(toItem),
  };
  await recsDocument(db, listId).set(doc);

  return {
    ...report,
    status: 'written',
    candidates: candidateIds.length,
    items: doc.items.length,
    trending: doc.trending.length,
    alpha: fitted.alpha,
    holdoutAccuracy: fitted.holdoutAccuracy,
    geminiReasons: [...items, ...trending].filter((rec) => reasons.has(rec.tmdbId)).length,
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
 * Pontua os filmes em alta e em cartaz: primeiro pelo que a lista do TMDb traz, depois, nos 15
 * melhores, com o documento buscado no TMDb (duração, streaming, diretores e palavras-chave).
 *
 * @param run - Execução.
 * @param fitted - Modelo da lista.
 * @param index - Índice da lista.
 * @param excluded - Ids que não podem ser sugeridos.
 * @param inItems - Ids já sugeridos em `items`.
 * @returns Até 15 sugestões, da maior nota para a menor.
 */
async function scoreTrending(
  run: RecsRun,
  fitted: FittedModel,
  index: ListIndex,
  excluded: ReadonlySet<number>,
  inItems: ReadonlySet<number>,
): Promise<ScoredRec[]> {
  const found = await gatherTrending(run, new Set([...excluded, ...inItems]));
  const best = found
    .map(({ candidate, source }) => scoreCandidate(fitted.model, candidate, source))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_TRENDING);
  const movies = await fetchMovies(
    run,
    best.map((rec) => rec.tmdbId),
  );
  return best
    .map((rec) => {
      const movie = movies.get(rec.tmdbId);
      if (!movie) return rec;
      return { ...scoreMovie(fitted.model, index, rec.tmdbId, movie, rec.source), candidate: rec.candidate };
    })
    .sort((a, b) => b.score - a.score);
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

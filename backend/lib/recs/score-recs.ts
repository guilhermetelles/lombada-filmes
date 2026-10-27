import { candidateFeatures, candidateGenres } from '../discover/score-candidates.js';
import { normalizeStreamingServices } from '../discover/streaming-names.js';
import type { DiscoverCandidate } from '../discover/tmdb-discover-client.js';
import type { Movie } from '../types/movie.js';
import type { RecItem, RecKind, RecSource, RecsModel } from '../types/recs.js';
import { movieFeatures, similarityTags, tagSimilarity } from './movie-features.js';
import {
  combineScores,
  FULL_SIMILARITY,
  findNeighbors,
  type ListTags,
  MIN_SIMILARITY,
  type Neighbor,
} from './neighbors.js';
import { modelScore } from './train-model.js';

/** Quantos filmes da lista, no máximo, justificam uma sugestão (reasonFrom). */
const MAX_REASON_FROM = 3;

/** Pontos a mais para um candidato muito parecido com um filme da fila "Quero ver". */
const QUEUE_BONUS = 8;

/** Pontos a menos para um candidato muito parecido com um filme marcado como "Não quero". */
const DISMISS_PENALTY = 15;

/** Um filme da lista: a entrada, a posição no ranking (1 é o topo) e o comentário da dupla. */
export type ListFilm = {
  entryId: string;
  tmdbId: number;
  position: number;
  comment: string;
  watchedOn: string | null; // AAAA-MM-DD
};

/** Filme da lista com o documento movies/{tmdbId}. */
export type ListFilmWithMovie = ListFilm & { movie: Movie };

/** Marcas dos filmes da fila "Quero ver" e dos marcados como "Não quero". */
export type FeedbackTags = { queued: ReadonlyMap<string, number>[]; dismissed: ReadonlyMap<string, number>[] };

/** O que a pontuação precisa da lista, montado uma vez. */
export type ListIndex = {
  size: number;
  films: ListFilmWithMovie[];
  tags: ListTags[];
  byEntryId: Map<string, ListFilmWithMovie>;
  feedback: FeedbackTags;
};

/** Por que a sugestão é da saga ou do diretor: o filme da lista que liga as duas coisas. */
export type Anchor = { film: ListFilmWithMovie; via: 'saga' | 'diretor'; label: string };

/** Uma sugestão pontuada, antes do motivo. */
export type ScoredRec = {
  tmdbId: number;
  source: RecSource;
  kind: RecKind;
  score: number;
  features: Record<string, number>;
  neighbors: Neighbor[];
  anchor: Anchor | undefined;
  reasonFrom: string[]; // entryIds
  groups: string[]; // saga e diretores, para a variedade
  tags: Map<string, number>;
  movie: Movie | undefined;
  candidate: DiscoverCandidate | undefined;
};

/**
 * Monta o índice da lista para pontuar: marcas e posição de cada filme que tem documento, e as
 * marcas dos filmes da fila e dos dispensados.
 *
 * @param films - Filmes da lista com o documento.
 * @param size - Quantos filmes a lista tem (inclusive os sem documento).
 * @param feedback - Documentos dos filmes da fila e dos marcados como "Não quero".
 * @returns O índice.
 */
export function buildListIndex(
  films: readonly ListFilmWithMovie[],
  size: number,
  feedback: { queued: readonly Movie[]; dismissed: readonly Movie[] } = { queued: [], dismissed: [] },
): ListIndex {
  return {
    size,
    films: [...films],
    tags: films.map(({ entryId, position, movie }) => ({ entryId, position, tags: similarityTags(movie) })),
    byEntryId: new Map(films.map((film) => [film.entryId, film])),
    feedback: { queued: feedback.queued.map(similarityTags), dismissed: feedback.dismissed.map(similarityTags) },
  };
}

/**
 * Ajuste da nota pelo que a dupla já respondeu: sobe com a semelhança com o filme mais parecido da
 * fila e desce com a do mais parecido entre os dispensados. Semelhança abaixo da mínima dos vizinhos
 * não conta, para gênero e década em comum não mexerem na nota.
 *
 * @param tags - Marcas do candidato.
 * @param feedback - Marcas da fila e dos dispensados.
 * @returns Pontos a somar (negativo para descer).
 */
export function feedbackAdjustment(tags: ReadonlyMap<string, number>, feedback: FeedbackTags): number {
  const strength = (list: readonly ReadonlyMap<string, number>[]) => {
    const similarity = list.reduce((max, other) => Math.max(max, tagSimilarity(tags, other)), 0);
    return Math.min(1, Math.max(0, similarity - MIN_SIMILARITY) / (FULL_SIMILARITY - MIN_SIMILARITY));
  };
  return QUEUE_BONUS * strength(feedback.queued) - DISMISS_PENALTY * strength(feedback.dismissed);
}

/**
 * Pontua um filme guardado: nota do modelo somada à dos vizinhos (filmes da lista mais
 * parecidos) e ajustada pela fila e pelos dispensados, o agrupamento (saga, diretor, tema ou em
 * alta) e os filmes da lista que justificam.
 *
 * @param model - Modelo da lista.
 * @param index - Índice da lista.
 * @param tmdbId - Id do filme.
 * @param movie - Documento do filme.
 * @param source - De onde veio a sugestão.
 * @returns A sugestão pontuada.
 */
export function scoreMovie(
  model: RecsModel,
  index: ListIndex,
  tmdbId: number,
  movie: Movie,
  source: RecSource,
): ScoredRec {
  const features = movieFeatures(movie);
  const tags = similarityTags(movie);
  const neighbors = findNeighbors(tags, index.tags);
  const anchor = findAnchor(movie, index);
  const kind: RecKind = source !== 'model' ? 'emAlta' : (anchor?.via ?? 'tema');
  const reasonFrom = [...new Set([...(anchor ? [anchor.film.entryId] : []), ...neighbors.map((n) => n.entryId)])].slice(
    0,
    MAX_REASON_FROM,
  );
  return {
    tmdbId,
    source,
    kind,
    score: clampScore(
      combineScores(modelScore(model, features), neighbors, index.size) + feedbackAdjustment(tags, index.feedback),
    ),
    features,
    neighbors,
    anchor,
    reasonFrom,
    groups: [
      ...(movie.collection ? [`collection:${movie.collection.id}`] : []),
      ...movie.directors.map((director) => `director:${director.id}`),
    ],
    tags,
    movie,
    candidate: undefined,
  };
}

/**
 * Pontua um filme em alta só com o que a lista do TMDb traz (sem documento guardado): só o modelo,
 * sem vizinhos.
 *
 * @param model - Modelo da lista.
 * @param candidate - Filme da lista do TMDb.
 * @param source - 'trending' ou 'nowPlaying'.
 * @returns A sugestão pontuada.
 */
export function scoreCandidate(model: RecsModel, candidate: DiscoverCandidate, source: RecSource): ScoredRec {
  const features = candidateFeatures(candidate);
  return {
    tmdbId: candidate.tmdbId,
    source,
    kind: 'emAlta',
    score: Math.round(modelScore(model, features)),
    features,
    neighbors: [],
    anchor: undefined,
    reasonFrom: [],
    groups: [],
    tags: new Map(),
    movie: undefined,
    candidate,
  };
}

/**
 * Arredonda e limita a nota a 0–100.
 *
 * @param score - Nota.
 * @returns A nota inteira entre 0 e 100.
 */
function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Monta o item gravado em recs/current.
 *
 * @param rec - Sugestão pontuada.
 * @param reason - Motivo já escrito.
 * @param reasonBy - Quem escreveu o motivo: o Gemini ou a reserva pelas variáveis.
 * @returns O item.
 */
export function toRecItem(rec: ScoredRec, reason: string, reasonBy: 'gemini' | 'rules'): RecItem {
  const { movie, candidate } = rec;
  const titleEn = movie ? movie.title : candidate?.titleEn;
  return {
    tmdbId: rec.tmdbId,
    title: movie ? (movie.titlePt ?? movie.title) : (candidate?.title ?? ''),
    ...(titleEn ? { titleEn } : {}),
    year: movie ? movie.year : (candidate?.year ?? null),
    posterPath: movie ? movie.posterPath : (candidate?.posterPath ?? null),
    runtime: movie?.runtime ?? null,
    genres: movie ? movie.genres : candidate ? candidateGenres(candidate) : [],
    providers: normalizeStreamingServices(movie?.providersBR?.flatrate ?? []),
    score: rec.score,
    reason,
    reasonFrom: rec.reasonFrom,
    reasonBy,
    source: rec.source,
    kind: rec.kind,
  };
}

/**
 * Acha o filme da lista que liga o candidato a uma saga começada ou a um diretor da lista: primeiro
 * a saga, depois o diretor; entre vários, o mais alto no ranking.
 *
 * @param movie - Documento do candidato.
 * @param index - Índice da lista.
 * @returns A ligação, ou undefined se não houver.
 */
function findAnchor(movie: Movie, index: ListIndex): Anchor | undefined {
  const byPosition = [...index.films].sort((a, b) => a.position - b.position);
  const collection = movie.collection;
  if (collection) {
    const film = byPosition.find((listFilm) => listFilm.movie.collection?.id === collection.id);
    if (film) return { film, via: 'saga', label: collection.name };
  }
  for (const film of byPosition) {
    const director = movie.directors.find((candidate) => film.movie.directors.some((d) => d.id === candidate.id));
    if (director) return { film, via: 'diretor', label: director.name };
  }
  return undefined;
}

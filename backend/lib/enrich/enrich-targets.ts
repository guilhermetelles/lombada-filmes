import type { Firestore } from 'firebase-admin/firestore';
import type { Movie } from '../types/movie.js';

/** Quantas pessoas do elenco contam para "recorrente", na ordem dos créditos. */
const CAST_FOR_RECURRENCE = 8;

/** Em quantos filmes da mesma lista a pessoa precisa aparecer para ser recorrente. */
const RECURRENCE_MIN_MOVIES = 2;

/** Filmes de cada lista e filmes da fila, lidos das entradas e da fila de todas as listas. */
export type EnrichTargets = {
  moviesByList: Map<string, number[]>; // listId -> ids do TMDb das entradas
  queueMovieIds: number[]; // ids do TMDb na fila de alguma lista, sem repetição, em ordem crescente
  allMovieIds: number[]; // filmes das listas e da fila, sem repetição, em ordem crescente
};

/**
 * Lê os filmes que a rotina enrich cobre: os das entradas de todas as listas e os da fila "Quero
 * ver". Usa as consultas collectionGroup de entries e queue, lendo só o campo tmdbId.
 *
 * @param db - Firestore.
 * @returns Filmes por lista, filmes da fila e todos juntos.
 */
async function readEnrichTargets(db: Firestore): Promise<EnrichTargets> {
  const [entries, queue] = await Promise.all([
    db.collectionGroup('entries').select('tmdbId').get(),
    db.collectionGroup('queue').select('tmdbId').get(),
  ]);

  const moviesByList = new Map<string, number[]>();
  for (const entry of entries.docs) {
    const listId = entry.ref.parent.parent?.id;
    const tmdbId = entry.get('tmdbId');
    if (!listId || typeof tmdbId !== 'number') continue;
    moviesByList.set(listId, [...(moviesByList.get(listId) ?? []), tmdbId]);
  }

  const queueMovieIds = sortedUnique(queue.docs.map((item) => item.get('tmdbId')).filter(isNumber));
  const allMovieIds = sortedUnique([...[...moviesByList.values()].flat(), ...queueMovieIds]);
  return { moviesByList, queueMovieIds, allMovieIds };
}

/**
 * Acha as pessoas recorrentes: quem dirige ou está entre os 8 primeiros do elenco de 2 ou mais
 * filmes de uma mesma lista. São elas que ganham ficha (aniversários) e prêmios pela rotina.
 *
 * @param moviesByList - Filmes de cada lista.
 * @param movies - Documentos dos filmes, por id.
 * @returns Ids de pessoa do TMDb, sem repetição, em ordem crescente.
 */
function findRecurrentPeople(moviesByList: Map<string, number[]>, movies: Map<number, Movie>): number[] {
  const recurrent = new Set<number>();
  for (const tmdbIds of moviesByList.values()) {
    const appearances = new Map<number, number>();
    for (const tmdbId of new Set(tmdbIds)) {
      const movie = movies.get(tmdbId);
      if (!movie) continue;
      const people = new Set([
        ...movie.directors.map((director) => director.id),
        ...movie.cast.slice(0, CAST_FOR_RECURRENCE).map((member) => member.id),
      ]);
      for (const personId of people) appearances.set(personId, (appearances.get(personId) ?? 0) + 1);
    }
    for (const [personId, count] of appearances) if (count >= RECURRENCE_MIN_MOVIES) recurrent.add(personId);
  }
  return [...recurrent].sort((a, b) => a - b);
}

/**
 * Tira repetidos e ordena em ordem crescente.
 *
 * @param ids - Ids.
 * @returns Os ids sem repetição, em ordem crescente.
 */
function sortedUnique(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Diz se um valor lido do Firestore é número.
 *
 * @param value - Valor lido.
 * @returns true se for número.
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export { findRecurrentPeople, readEnrichTargets };

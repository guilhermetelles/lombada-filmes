import type { DailyContext, DailyList } from '../../lib/daily/daily-content.js';
import type { RankedEntry } from '../../lib/events/list-entries.js';
import type { Dependencies } from '../../lib/types/dependencies.js';
import type { Movie } from '../../lib/types/movie.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';

/** Montagem de listas e filmes para testar os assuntos da notificação diária sem banco. */

/** O que uma entrada de teste precisa dizer; o resto tem valor neutro. */
type EntrySample = Partial<RankedEntry> & { entryId: string; tmdbId: number; title: string };

/**
 * Monta uma entrada já com posição.
 *
 * @param sample - Id, filme, título e o que mais o teste precisar.
 * @param position - Posição no ranking.
 * @returns A entrada.
 */
export function rankedEntry({ entryId, tmdbId, title, ...rest }: EntrySample, position: number): RankedEntry {
  return {
    entryId,
    tmdbId,
    position,
    rankKey: `a${String(position).padStart(4, '0')}`,
    watchedOn: null,
    comment: '',
    addedBy: 'ana',
    updatedBy: 'ana',
    createdAt: new Date('2025-01-01T12:00:00Z'),
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    movie: { title, year: null, posterPath: null, imdb: null, letterboxd: null, directors: [] },
    ...rest,
  };
}

/**
 * Monta um filme de movies/ com os campos obrigatórios neutros.
 *
 * @param title - Título.
 * @param extra - Campos do teste.
 * @returns O filme.
 */
export function sampleMovie(title: string, extra: Partial<Movie> = {}): Movie {
  return {
    title,
    year: null,
    directors: [],
    cast: [],
    runtime: null,
    genres: [],
    synopsis: { pt: null, en: null },
    posterPath: null,
    ids: { imdb: null, letterboxd: null },
    ratings: {},
    tmdbFetchedAt: new Date('2026-10-01T12:00:00Z'),
    ...extra,
  };
}

/**
 * Monta a lista lida pela rotina, numerando as entradas na ordem dada.
 *
 * @param entries - Entradas, da primeira para a última.
 * @param movies - Filmes por id.
 * @param releases - Datas de estreia por id.
 * @returns A lista.
 */
export function sampleList(
  entries: EntrySample[],
  movies: Map<number, Movie> = new Map(),
  releases: Map<number, string> = new Map(),
): DailyList {
  return {
    listId: 'lista-1',
    list: {
      name: 'Maratona',
      description: '',
      ownerUid: 'ana',
      memberUids: ['ana', 'bia'],
      memberProfiles: { ana: { name: 'Ana', photoUrl: null }, bia: { name: 'Bia', photoUrl: null } },
      createdAt: new Date('2025-01-01T12:00:00Z'),
      updatedAt: new Date('2025-01-01T12:00:00Z'),
    },
    entries: entries.map((entry, index) => rankedEntry(entry, index + 1)),
    movies,
    releases,
  };
}

/**
 * Contexto de um assunto que não usa banco nem fontes (as dependências ficam vazias).
 *
 * @param list - Lista.
 * @param day - Dia de Brasília.
 * @param now - Momento da execução.
 * @returns O contexto.
 */
export function offlineContext(list: DailyList, day: string, now = new Date(`${day}T22:00:00Z`)): DailyContext {
  return {
    dependencies: {} as Dependencies,
    usage: new UsageMeter(),
    list,
    uid: 'ana',
    day,
    now,
  };
}

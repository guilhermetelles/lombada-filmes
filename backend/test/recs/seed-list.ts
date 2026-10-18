import type { Firestore } from 'firebase-admin/firestore';
import { withoutUndefined } from '../../lib/firestore/without-undefined.js';
import type { Movie } from '../../lib/types/movie.js';
import { makeMovie } from './synthetic-movies.js';

/** Id da lista de teste. */
export const LIST_ID = 'lista-de-teste';

/** Um filme da lista de teste: id, documento e comentário (textos de teste, não da dupla). */
type SeedFilm = { tmdbId: number; movie: Partial<Movie>; comment?: string; watchedOn?: string };

/**
 * Filmes da lista de teste, do topo para baixo. 101 e 102 têm o mesmo diretor (900, recorrente);
 * 101 é de uma saga (50); todos recomendam candidatos de 201 a 210.
 */
export const SEED_FILMS: SeedFilm[] = [
  {
    tmdbId: 101,
    movie: {
      title: 'Topo da Saga',
      genres: ['Terror'],
      keywords: ['zombie', 'mall'],
      directors: [{ id: 900, name: 'Diretora Recorrente', profilePath: null }],
      collection: { id: 50, name: 'Saga de Teste' },
      recs: [201, 202, 203, 204],
      year: 1978,
    },
    comment: 'Comentário de teste: a Joana Teste adorou os zumbis no shopping',
  },
  {
    tmdbId: 102,
    movie: {
      title: 'Segundo da Diretora',
      genres: ['Terror', 'Comédia'],
      keywords: ['zombie'],
      directors: [{ id: 900, name: 'Diretora Recorrente', profilePath: null }],
      recs: [205, 206],
      year: 1985,
    },
    comment: 'Comentário de teste dois',
  },
  { tmdbId: 103, movie: { title: 'Meio', genres: ['Comédia'], keywords: ['road trip'], recs: [207], year: 1999 } },
  { tmdbId: 104, movie: { title: 'Quarto', genres: ['Drama'], keywords: ['grief'], recs: [208], year: 2005 } },
  { tmdbId: 105, movie: { title: 'Quinto', genres: ['Romance'], keywords: ['wedding'], recs: [209], year: 2012 } },
  {
    tmdbId: 106,
    movie: { title: 'Último', genres: ['Romance', 'Drama'], keywords: ['wedding'], recs: [210], year: 2015 },
  },
];

/**
 * Grava a lista de teste: lists/{LIST_ID} com o membro, as entradas na ordem, os documentos dos
 * filmes (frescos, com os campos extras do TMDb), a ficha da diretora recorrente, um filme na fila
 * (202) e um marcado como "Não quero" (203).
 *
 * @param db - Firestore do emulador.
 * @param uid - Membro da lista.
 * @param now - Relógio do teste (data dos documentos).
 */
export async function seedList(db: Firestore, uid: string, now: Date): Promise<void> {
  await db.doc(`lists/${LIST_ID}`).set({
    name: 'Lista de teste',
    description: '',
    ownerUid: uid,
    memberUids: [uid],
    memberProfiles: { [uid]: { name: 'Joana Teste', photoUrl: null } },
    createdAt: now,
    updatedAt: now,
  });
  await Promise.all(
    SEED_FILMS.map(async ({ tmdbId, movie, comment, watchedOn }, index) => {
      await db.doc(`lists/${LIST_ID}/entries/e${tmdbId}`).set({
        tmdbId,
        rankKey: `a${index}`,
        watchedOn: watchedOn ?? `2025-0${1 + index}-10`,
        comment: comment ?? '',
        addedBy: uid,
        updatedBy: uid,
        createdAt: now,
        updatedAt: now,
        movie: {
          title: movie.title ?? '',
          year: movie.year ?? null,
          posterPath: null,
          imdb: null,
          letterboxd: null,
          directors: [],
        },
      });
      await db.doc(`movies/${tmdbId}`).set(withoutUndefined(makeMovie({ tmdbFetchedAt: now, ...movie })));
    }),
  );
  await db.doc('people/900').set({
    name: 'Diretora Recorrente',
    birthday: null,
    deathday: null,
    placeOfBirth: null,
    biography: null,
    bioLang: null,
    profilePath: null,
    imdbId: null,
    directedCount: 3,
    directed: [
      { tmdbId: 101, title: 'Topo da Saga', year: 1978 },
      { tmdbId: 211, title: 'Outro da Diretora', year: 1990 },
    ],
    actedCount: 0,
    acted: [],
    fetchedAt: now,
  });
  await db.doc(`lists/${LIST_ID}/queue/202`).set({ tmdbId: 202, addedBy: uid, createdAt: now });
  await db.doc(`lists/${LIST_ID}/dismissed/203`).set({ by: uid, at: now });
}

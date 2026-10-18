import type { Firestore } from 'firebase-admin/firestore';
import { generateNKeysBetween } from 'fractional-indexing';
import type { ListMaterial, RankedEntry } from '../../lib/quiz/list-material.js';
import type { AwardItem } from '../../lib/types/awards.js';
import type { Movie } from '../../lib/types/movie.js';
import type { UsageRecorder } from '../../lib/types/usage.js';

/** Dados de teste do quiz e da retrospectiva: filmes reais com dados resumidos e comentários de teste. */

/** Quando os dados de teste foram "buscados". */
const FETCHED_AT = new Date('2026-09-01T12:00:00Z');

/** Um filme de teste na ordem do ranking: o documento movies/{tmdbId} e os campos da entrada. */
export type SampleFilm = { tmdbId: number; movie: Movie; watchedOn: string | null; comment: string };

/**
 * Monta um movies/{tmdbId} de teste com o mínimo do formato e os campos dados.
 *
 * @param fields - Campos do filme que o teste usa.
 * @returns O documento completo.
 */
function sampleMovie(fields: Partial<Movie> & Pick<Movie, 'title' | 'year'>): Movie {
  return {
    directors: [],
    cast: [],
    runtime: null,
    genres: [],
    synopsis: { pt: null, en: null },
    posterPath: null,
    ids: { imdb: null, letterboxd: null },
    ratings: {},
    tmdbFetchedAt: FETCHED_AT,
    ...fields,
  };
}

/**
 * Prêmios buscados, no formato de movies/{tmdbId}.awards.
 *
 * @param items - Vitórias e indicações (vazio: buscado e sem nenhum).
 * @returns O campo awards.
 */
function awards(items: AwardItem[]): Movie['awards'] {
  return { items, summary: null, fetchedAt: FETCHED_AT };
}

/**
 * Teste de Bechdel com a nota dada.
 *
 * @param rating - Critérios cumpridos.
 * @returns O campo bechdel.
 */
function bechdel(rating: number): Movie['bechdel'] {
  return { siteId: rating + 100, url: null, rating, dubious: false, disputes: 0, fetchedAt: FETCHED_AT };
}

/** Oito filmes, do primeiro ao último do ranking. */
export const SAMPLE_FILMS: SampleFilm[] = [
  {
    tmdbId: 2756,
    movie: sampleMovie({
      title: 'The Abyss',
      year: 1989,
      directors: [{ id: 2710, name: 'James Cameron' }],
      cast: [
        { id: 228, name: 'Ed Harris', character: "Virgil 'Bud' Brigman", profilePath: '/harris.jpg' },
        { id: 3201, name: 'Mary Elizabeth Mastrantonio', character: 'Lindsey Brigman', profilePath: '/mem.jpg' },
        { id: 2712, name: 'Michael Biehn', character: 'Lt. Hiram Coffey', profilePath: '/biehn.jpg' },
        { id: 8337, name: 'Leo Burmester', character: 'Catfish De Vries', profilePath: null },
        { id: 1210, name: 'Todd Graff', character: "Alan 'Hippy' Carnes", profilePath: '/graff.jpg' },
      ],
      runtime: 140,
      genres: ['Aventura', 'Ficção científica'],
      synopsis: { pt: 'Mergulhadores de uma plataforma de petróleo ajudam a resgatar um submarino nuclear.', en: null },
      posterPath: '/abyss.jpg',
      titlePt: 'O Segredo do Abismo',
      budget: 70_000_000,
      awards: awards([{ org: 'Oscar', cat: 'Melhores Efeitos Visuais', kind: 'win', year: 1990 }]),
      bechdel: bechdel(3),
    }),
    watchedOn: '2026-09-05',
    comment:
      'Primeira vez que vimos juntas e já virou referência. A cena do rato respirando líquido ainda assusta a gente. Abyss merece mais carinho do que recebe.',
  },
  {
    tmdbId: 2675,
    movie: sampleMovie({
      title: 'Signs',
      year: 2002,
      directors: [{ id: 11614, name: 'M. Night Shyamalan' }],
      runtime: 106,
      genres: ['Ficção científica', 'Thriller'],
      synopsis: { pt: 'Um ex-pastor encontra círculos misteriosos na plantação da família.', en: null },
      posterPath: '/signs.jpg',
      budget: 72_000_000,
      awards: awards([]),
      bechdel: bechdel(1),
    }),
    watchedOn: '2026-09-20',
    comment: 'O copo de água na cabeceira de cada cômodo é a melhor coisa do filme inteiro, sem discussão.',
  },
  {
    tmdbId: 161,
    movie: sampleMovie({
      title: "Ocean's Eleven",
      year: 2001,
      directors: [{ id: 1884, name: 'Steven Soderbergh' }],
      runtime: 116,
      genres: ['Crime', 'Thriller'],
      posterPath: '/oceans.jpg',
      budget: 85_000_000,
      awards: awards([]),
    }),
    watchedOn: '2026-09-27',
    comment: '',
  },
  {
    tmdbId: 115,
    movie: sampleMovie({
      title: 'The Big Lebowski',
      year: 1998,
      directors: [
        { id: 1223, name: 'Joel Coen' },
        { id: 1224, name: 'Ethan Coen' },
      ],
      runtime: 117,
      genres: ['Comédia', 'Crime'],
      posterPath: '/lebowski.jpg',
      budget: 15_000_000,
      awards: awards([]),
    }),
    watchedOn: '2025-03-14',
    comment: 'Ninguém entendeu o tapete, mas todo mundo concordou que ele dava um tom à sala.',
  },
  {
    tmdbId: 107,
    movie: sampleMovie({
      title: 'Snatch',
      year: 2000,
      directors: [{ id: 956, name: 'Guy Ritchie' }],
      runtime: 104,
      genres: ['Crime', 'Comédia'],
      posterPath: '/snatch.jpg',
      budget: 10_000_000,
      awards: awards([]),
    }),
    watchedOn: '2025-06-02',
    comment: 'Não entendemos uma palavra do que o lutador fala e foi perfeito assim.',
  },
  {
    tmdbId: 1637,
    movie: sampleMovie({
      title: 'Speed',
      year: 1994,
      directors: [{ id: 2209, name: 'Jan de Bont' }],
      runtime: 116,
      genres: ['Ação', 'Thriller'],
      posterPath: '/speed.jpg',
      budget: 30_000_000,
      awards: awards([{ org: 'Oscar', cat: 'Melhor Som', kind: 'win', year: 1995 }]),
    }),
    watchedOn: null,
    comment: 'O ônibus não pode passar de oitenta e a gente também não podia piscar.',
  },
  {
    tmdbId: 8914,
    movie: sampleMovie({
      title: 'Deep Blue Sea',
      year: 1999,
      directors: [{ id: 7187, name: 'Renny Harlin' }],
      runtime: 105,
      genres: ['Ação', 'Terror'],
      posterPath: '/deep-blue-sea.jpg',
      budget: 60_000_000,
      awards: awards([]),
    }),
    watchedOn: '2026-08-30',
    comment: 'O discurso interrompido é a melhor reviravolta de todos os tempos.',
  },
  {
    tmdbId: 5491,
    movie: sampleMovie({
      title: 'Battlefield Earth',
      year: 2000,
      directors: [{ id: 21149, name: 'Roger Christian' }],
      runtime: 118,
      genres: ['Ficção científica', 'Ação'],
      posterPath: '/battlefield-earth.jpg',
      budget: 44_000_000,
      awards: awards([{ org: 'Framboesa de Ouro', cat: 'Pior Filme', kind: 'win', year: 2001 }]),
    }),
    watchedOn: '2026-09-28',
    comment: 'Tudo inclinado, o tempo todo. Sentimos enjoo de câmera torta.',
  },
];

/**
 * Monta o material de uma lista a partir dos filmes de teste, sem banco.
 *
 * @param films - Filmes na ordem do ranking.
 * @param memberNames - Nomes dos membros.
 * @returns O material que os geradores recebem.
 */
export function sampleMaterial(
  films: SampleFilm[] = SAMPLE_FILMS,
  memberNames: string[] = ['Ana', 'Bia'],
): ListMaterial {
  const entries = films.map(
    (film, index): RankedEntry => ({
      entryId: `entrada-${film.tmdbId}`,
      rank: index + 1,
      tmdbId: film.tmdbId,
      watchedOn: film.watchedOn,
      comment: film.comment,
      title: film.movie.title,
      year: film.movie.year,
      posterPath: film.movie.posterPath,
      movie: film.movie,
    }),
  );
  return { listId: 'lista-teste', entries, memberNames };
}

/**
 * Grava uma lista de teste com membros, entradas (ids `entrada-{tmdbId}`) e os filmes.
 *
 * @param db - Firestore do emulador.
 * @param listId - Id da lista.
 * @param members - Membros, com uid e nome.
 * @param films - Filmes na ordem do ranking.
 */
export async function seedSampleList(
  db: Firestore,
  listId: string,
  members: { uid: string; name: string }[],
  films: SampleFilm[] = SAMPLE_FILMS,
): Promise<void> {
  const createdAt = new Date('2026-09-01T12:00:00Z');
  const owner = members[0]?.uid ?? 'dona';
  await db.doc(`lists/${listId}`).set({
    name: 'Lista de teste',
    description: '',
    ownerUid: owner,
    memberUids: members.map((member) => member.uid),
    memberProfiles: Object.fromEntries(members.map((member) => [member.uid, { name: member.name, photoUrl: null }])),
    createdAt,
    updatedAt: createdAt,
  });
  const rankKeys = generateNKeysBetween(null, null, films.length);
  const batch = db.batch();
  films.forEach((film, index) => {
    batch.set(db.doc(`movies/${film.tmdbId}`), film.movie);
    batch.set(db.doc(`lists/${listId}/entries/entrada-${film.tmdbId}`), {
      tmdbId: film.tmdbId,
      rankKey: rankKeys[index],
      watchedOn: film.watchedOn,
      comment: film.comment,
      addedBy: owner,
      updatedBy: owner,
      createdAt,
      updatedAt: createdAt,
      movie: {
        title: film.movie.title,
        year: film.movie.year,
        posterPath: film.movie.posterPath,
        imdb: null,
        letterboxd: null,
        directors: film.movie.directors.map(({ id, name }) => ({ id, name })),
      },
    });
  });
  await batch.commit();
}

/** Medidor de consumo que só executa as chamadas e conta as do Gemini. */
export type CountingUsage = UsageRecorder & { calls: number };

/**
 * Cria um medidor de consumo para testes sem banco.
 *
 * @returns O medidor, com o total de chamadas registradas.
 */
export function countingUsage(): CountingUsage {
  const usage: CountingUsage = {
    calls: 0,
    count() {},
    async track(_source, call) {
      usage.calls++;
      return call();
    },
  };
  return usage;
}

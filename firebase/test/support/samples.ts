import { type FieldValue, serverTimestamp, Timestamp } from 'firebase/firestore';

/** Pessoas dos testes: a dona da lista L1, uma integrante e alguém de fora. */
export const OWNER = 'uidA';
/** Integrante da lista L1. */
export const MEMBER = 'uidB';
/** Alguém de fora da lista L1. */
export const OUTSIDER = 'uidC';

/** Momento no passado, para documentos já gravados. */
export const PAST = Timestamp.fromDate(new Date('2020-01-01'));

/** Campos de um documento. */
type Fields = Record<string, unknown>;

/** Cópia resumida de The Abyss, como o app grava numa entrada. */
export const movieSnapshot = {
  title: 'The Abyss',
  year: 1989,
  posterPath: '/kRP5.jpg',
  imdb: 7.5,
  letterboxd: 3.72,
  directors: [{ id: 2710, name: 'James Cameron' }],
};

/** Valor que o Firestore troca pela hora do servidor ao gravar. */
const serverTime = (): FieldValue => serverTimestamp();

/** Documentos como o app grava (createdAt e updatedAt com a hora do servidor). */

/**
 * Perfil como o app grava na criação.
 *
 * @param overrides - Campos a trocar ou acrescentar.
 * @returns Os campos do documento.
 */
export function newUser(overrides: Fields = {}): Fields {
  return {
    displayName: 'Guilherme',
    photoUrl: 'https://example.com/a.png',
    recentListIds: 'L1',
    activeListId: 'L1',
    createdAt: serverTime(),
    updatedAt: serverTime(),
    ...overrides,
  };
}

/**
 * Lista como o app grava na criação: a pessoa como dona e única integrante.
 *
 * @param ownerUid - Quem cria a lista.
 * @param overrides - Campos a trocar ou acrescentar.
 * @returns Os campos do documento.
 */
export function newList(ownerUid: string, overrides: Fields = {}): Fields {
  return {
    name: 'Maratona',
    description: '',
    ownerUid,
    memberUids: [ownerUid],
    createdAt: serverTime(),
    updatedAt: serverTime(),
    ...overrides,
  };
}

/**
 * Entrada como o app grava ao adicionar um filme.
 *
 * @param uid - Quem adiciona.
 * @param overrides - Campos a trocar ou acrescentar.
 * @returns Os campos do documento.
 */
export function newEntry(uid: string, overrides: Fields = {}): Fields {
  return {
    tmdbId: 2756,
    rankKey: 'a0',
    watchedOn: '2025-10-12',
    comment: 'ESSE FILME É INCRÍVEL',
    addedBy: uid,
    updatedBy: uid,
    createdAt: serverTime(),
    updatedAt: serverTime(),
    movie: movieSnapshot,
    ...overrides,
  };
}

/** Os mesmos documentos já gravados no passado, para os dados de partida. */

/**
 * Perfil já gravado no passado, para os dados de partida.
 *
 * @returns Os campos do documento.
 */
export function storedUser(): Fields {
  return newUser({ createdAt: PAST, updatedAt: PAST });
}

/**
 * Entrada já gravada no passado, para os dados de partida.
 *
 * @param uid - Quem adicionou.
 * @returns Os campos do documento.
 */
export function storedEntry(uid: string): Fields {
  return newEntry(uid, { createdAt: PAST, updatedAt: PAST });
}

/**
 * Marca de edição exigida em toda gravação de entrada.
 *
 * @param uid - Quem edita.
 * @returns updatedBy e updatedAt.
 */
export function editedBy(uid: string): Fields {
  return { updatedBy: uid, updatedAt: serverTime() };
}

/**
 * Marca de edição exigida em perfis e listas.
 *
 * @returns updatedAt com a hora do servidor.
 */
export function updatedNow(): Fields {
  return { updatedAt: serverTime() };
}

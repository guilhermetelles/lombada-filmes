import { describe, test } from 'node:test';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { allows, denies } from './support/expectations.js';
import { useRulesEnvironment } from './support/rules-environment.js';
import { MEMBER, newList, OUTSIDER, OWNER, updatedNow } from './support/samples.js';

const firestoreAs = useRulesEnvironment();
const existingList = (as: string | null) => doc(firestoreAs(as), 'lists/L1');
const newListDoc = (as: string | null) => doc(firestoreAs(as), 'lists/L2');
const editAsMember = (fields: Record<string, unknown>) =>
  updateDoc(existingList(MEMBER), { ...fields, ...updatedNow() });

describe('lists: criação', () => {
  test('nem uma lista válida é criada pelo app (passa pelo backend)', () =>
    denies(setDoc(newListDoc(OWNER), newList(OWNER))));
  test('cria lista já incluindo outra pessoa como membro', () =>
    denies(setDoc(newListDoc(OWNER), newList(OWNER, { memberUids: [OWNER, OUTSIDER] }))));
  test('cria lista em nome de outra pessoa', () =>
    denies(setDoc(newListDoc(OWNER), newList(MEMBER, { memberUids: [OWNER] }))));
  test('cria lista com source', () =>
    denies(setDoc(newListDoc(OWNER), newList(OWNER, { source: { letterboxdUrl: 'https://boxd.it/x' } }))));
  test('cria lista com nome só de espaços', () => denies(setDoc(newListDoc(OWNER), newList(OWNER, { name: '   ' }))));
  test('sem login cria lista', () => denies(setDoc(newListDoc(null), newList(OWNER))));
});

describe('lists: leitura', () => {
  test('membro lê a lista', () => allows(getDoc(existingList(MEMBER))));
  test('quem não é membro lê a lista', () => denies(getDoc(existingList(OUTSIDER))));
  test('consulta "minhas listas" com array-contains', () =>
    allows(
      getDocs(query(collection(firestoreAs(OUTSIDER), 'lists'), where('memberUids', 'array-contains', OUTSIDER))),
    ));
  test('consulta todas as listas sem filtro', () => denies(getDocs(collection(firestoreAs(OUTSIDER), 'lists'))));
});

describe('lists: edição', () => {
  test('membro edita nome e descrição', () => allows(editAsMember({ name: 'Novo nome', description: 'Nova' })));
  test('membro se faz dono', () => denies(editAsMember({ ownerUid: MEMBER })));
  test('membro adiciona alguém em memberUids', () => denies(editAsMember({ memberUids: [OWNER, MEMBER, OUTSIDER] })));
  test('membro remove a dona de memberUids', () => denies(editAsMember({ memberUids: [MEMBER] })));
  test('quem é de fora se adiciona em memberUids', () =>
    denies(updateDoc(existingList(OUTSIDER), { memberUids: [OWNER, MEMBER, OUTSIDER], ...updatedNow() })));
  test('nome curto seguido de 1 MB de espaços', () => denies(editAsMember({ name: `a${' '.repeat(1_000_000)}` })));
  test('descrição com 281 caracteres', () => denies(editAsMember({ description: 'x'.repeat(281) })));
  test('nome com 1000 caracteres', () => denies(editAsMember({ name: 'x'.repeat(1000) })));
  test('campo extra', () => denies(editAsMember({ hacked: true })));
  test('muda createdAt', () => denies(editAsMember({ createdAt: serverTimestamp() })));
});

describe('lists: exclusão', () => {
  test('nem a dona exclui a lista pelo app', () => denies(deleteDoc(existingList(OWNER))));
});

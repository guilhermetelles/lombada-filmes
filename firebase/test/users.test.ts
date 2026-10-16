import { describe, test } from 'node:test';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { allows, denies } from './support/expectations.js';
import { useRulesEnvironment } from './support/rules-environment.js';
import { MEMBER, newUser, OUTSIDER, OWNER, PAST, updatedNow } from './support/samples.js';

const firestoreAs = useRulesEnvironment();
const profileOf = (uid: string, as: string | null = uid) => doc(firestoreAs(as), `users/${uid}`);
const updateOwnProfile = (fields: Record<string, unknown>) =>
  updateDoc(profileOf(OWNER), { ...fields, ...updatedNow() });

describe('users: criação e leitura', () => {
  test('cria o próprio perfil válido', () => allows(setDoc(profileOf(OUTSIDER), newUser())));
  test('cria perfil sem listas visitadas', () =>
    allows(setDoc(profileOf(OUTSIDER), newUser({ recentListIds: '', activeListId: null }))));
  test('lê o perfil de outra pessoa', () => denies(getDoc(profileOf(MEMBER, OWNER))));
  test('sem login lê um perfil', () => denies(getDoc(profileOf(OWNER, null))));
  test('cria perfil com campo extra isAdmin', () => denies(setDoc(profileOf(OWNER), newUser({ isAdmin: true }))));
  test('cria perfil para outra pessoa', () => denies(setDoc(profileOf(MEMBER, OWNER), newUser())));
});

describe('users: edição', () => {
  test('muda createdAt', () => denies(updateOwnProfile({ createdAt: serverTimestamp() })));
  test('atualiza as listas visitadas', () => allows(updateOwnProfile({ recentListIds: 'L2,L1', activeListId: 'L2' })));
  test('recentListIds com id gigante', () => denies(updateOwnProfile({ recentListIds: 'x'.repeat(100_000) })));
  test('recentListIds como lista em vez de texto', () => denies(updateOwnProfile({ recentListIds: ['L1', 42] })));
  test('recentListIds com ids repetidos', () => denies(updateOwnProfile({ recentListIds: 'L1,L1' })));
  test('recentListIds com 201 ids', () =>
    denies(updateOwnProfile({ recentListIds: Array.from({ length: 201 }, (_, i) => `L${i}`).join(',') })));
  test('recentListIds com caractere inválido', () => denies(updateOwnProfile({ recentListIds: 'L1,../x' })));
  test('recentListIds com vírgula sobrando', () => denies(updateOwnProfile({ recentListIds: 'L1,' })));
  test('displayName com 81 caracteres', () => denies(updateOwnProfile({ displayName: 'x'.repeat(81) })));
  test('updatedAt no passado', () => denies(updateDoc(profileOf(OWNER), { displayName: 'G', updatedAt: PAST })));
  test('photoUrl javascript:', () => denies(updateOwnProfile({ photoUrl: 'javascript:alert(1)' })));
});

describe('users: exclusão', () => {
  test('apaga o próprio perfil', () => allows(deleteDoc(profileOf(OWNER))));
  test('apaga o perfil de outra pessoa', () => denies(deleteDoc(profileOf(OWNER, MEMBER))));
});

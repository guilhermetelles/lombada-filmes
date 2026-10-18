import { describe, test } from 'node:test';
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { allows, denies } from './support/expectations.js';
import { useRulesEnvironment } from './support/rules-environment.js';
import { MEMBER, newUser, OUTSIDER, OWNER, PAST, updatedNow } from './support/samples.js';

const firestoreAs = useRulesEnvironment();
const profileOf = (uid: string, as: string | null = uid) => doc(firestoreAs(as), `users/${uid}`);
const updateOwnProfile = (fields: Record<string, unknown>) =>
  updateDoc(profileOf(OWNER), { ...fields, ...updatedNow() });
// A integrante já tem feedSeenAt gravado; a dona não.
const updateMemberProfile = (fields: Record<string, unknown>) =>
  updateDoc(profileOf(MEMBER), { ...fields, ...updatedNow() });
const manyLists = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`L${i}`, PAST]));

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

describe('users: visitar e esquecer listas como o app 0.2.0 (UserRepository.visit/forget)', () => {
  test('visita sem feedSeenAt no perfil', () =>
    allows(updateOwnProfile({ recentListIds: 'L2,L1', activeListId: 'L2' })));
  test('esquece sem feedSeenAt no perfil', () => allows(updateOwnProfile({ recentListIds: '', activeListId: null })));
  test('visita com feedSeenAt no perfil', () =>
    allows(updateMemberProfile({ recentListIds: 'L2,L1', activeListId: 'L2' })));
  test('esquece com feedSeenAt no perfil', () =>
    allows(updateMemberProfile({ recentListIds: '', activeListId: null })));
});

describe('users: feedSeenAt', () => {
  test('marca o feed visto pela primeira vez', () => allows(updateOwnProfile({ 'feedSeenAt.L1': serverTimestamp() })));
  test('marca o feed visto de novo', () => allows(updateMemberProfile({ 'feedSeenAt.L1': serverTimestamp() })));
  test('tira uma lista de feedSeenAt', () => allows(updateMemberProfile({ 'feedSeenAt.L1': deleteField() })));
  test('cria perfil já com feedSeenAt', () =>
    allows(setDoc(profileOf(OUTSIDER), newUser({ feedSeenAt: { L1: serverTimestamp() } }))));
  test('feedSeenAt com 200 listas', () => allows(updateOwnProfile({ feedSeenAt: manyLists(200) })));
  test('feedSeenAt com 201 listas', () => denies(updateOwnProfile({ feedSeenAt: manyLists(201) })));
  test('feedSeenAt como texto', () => denies(updateOwnProfile({ feedSeenAt: 'L1' })));
  test('feedSeenAt como lista', () => denies(updateOwnProfile({ feedSeenAt: ['L1'] })));
  test('marca o feed sem updatedAt', () => denies(updateDoc(profileOf(OWNER), { 'feedSeenAt.L1': serverTimestamp() })));
  test('marca o feed no perfil de outra pessoa', () =>
    denies(updateDoc(profileOf(MEMBER, OWNER), { 'feedSeenAt.L1': serverTimestamp(), ...updatedNow() })));
});

describe('users: exclusão', () => {
  test('apaga o próprio perfil', () => allows(deleteDoc(profileOf(OWNER))));
  test('apaga o perfil de outra pessoa', () => denies(deleteDoc(profileOf(OWNER, MEMBER))));
});

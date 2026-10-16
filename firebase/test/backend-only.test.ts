import { describe, test } from 'node:test';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { allows, denies } from './support/expectations.js';
import { useRulesEnvironment } from './support/rules-environment.js';
import { MEMBER, OUTSIDER } from './support/samples.js';

const firestoreAs = useRulesEnvironment();

describe('invites: só o backend', () => {
  test('membro lê um código', () => denies(getDoc(doc(firestoreAs(MEMBER), 'invites/7Q4KMX'))));
  test('alguém lista os códigos', () => denies(getDocs(collection(firestoreAs(OUTSIDER), 'invites'))));
  test('alguém cria um código', () => denies(setDoc(doc(firestoreAs(OUTSIDER), 'invites/AAAAAA'), { listId: 'L1' })));
});

describe('movies: logados leem, só o backend grava', () => {
  test('logado lê um filme', () => allows(getDoc(doc(firestoreAs(OUTSIDER), 'movies/2756'))));
  test('sem login lê um filme', () => denies(getDoc(doc(firestoreAs(null), 'movies/2756'))));
  test('logado grava um filme', () => denies(setDoc(doc(firestoreAs(MEMBER), 'movies/2756'), { title: 'x' })));
});

describe('people: logados leem, só o backend grava', () => {
  test('logado lê uma pessoa', () => allows(getDoc(doc(firestoreAs(OUTSIDER), 'people/2710'))));
  test('sem login lê uma pessoa', () => denies(getDoc(doc(firestoreAs(null), 'people/2710'))));
  test('logado grava uma pessoa', () => denies(setDoc(doc(firestoreAs(MEMBER), 'people/2710'), { name: 'x' })));
});

describe('usage: logados leem, só o backend grava', () => {
  test('logado lê o consumo', () => allows(getDoc(doc(firestoreAs(MEMBER), 'usage/2026-10-16'))));
  test('logado grava o consumo', () =>
    denies(setDoc(doc(firestoreAs(MEMBER), 'usage/2026-10-16'), { omdb: { calls: 0 } })));
});

describe('qualquer outra coleção', () => {
  test('é negada', () => denies(setDoc(doc(firestoreAs(MEMBER), 'segredos/x'), { a: 1 })));
});

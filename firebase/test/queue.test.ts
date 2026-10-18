import { describe, test } from 'node:test';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { allows, denies } from './support/expectations.js';
import { useRulesEnvironment } from './support/rules-environment.js';
import { MEMBER, OUTSIDER } from './support/samples.js';

const firestoreAs = useRulesEnvironment();
const queued = (as: string | null, tmdbId = '603') => doc(firestoreAs(as), `lists/L1/queue/${tmdbId}`);
const queueOf = (as: string | null) => collection(firestoreAs(as), 'lists/L1/queue');

describe('queue: membros leem, só o backend grava', () => {
  test('membro lê um filme da fila', () => allows(getDoc(queued(MEMBER))));
  test('membro lista a fila', () => allows(getDocs(queueOf(MEMBER))));
  test('quem não é membro lista a fila', () => denies(getDocs(queueOf(OUTSIDER))));
  test('quem não é membro lê um filme da fila', () => denies(getDoc(queued(OUTSIDER))));
  test('sem login lista a fila', () => denies(getDocs(queueOf(null))));
  test('membro põe um filme na fila', () =>
    denies(setDoc(queued(MEMBER, '27205'), { tmdbId: 27205, addedBy: MEMBER, createdAt: serverTimestamp() })));
  test('membro edita um filme da fila', () => denies(updateDoc(queued(MEMBER), { addedBy: MEMBER })));
  test('membro tira um filme da fila', () => denies(deleteDoc(queued(MEMBER))));
});

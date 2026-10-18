import { describe, test } from 'node:test';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { allows, denies } from './support/expectations.js';
import { useRulesEnvironment } from './support/rules-environment.js';
import { ANSWERED_DAY, MEMBER, OTHER_DAY, OUTSIDER, OWNER } from './support/samples.js';

// Dados de partida: em ANSWERED_DAY responderam a dona e alguém que já saiu da lista; a integrante
// só respondeu o quiz de OTHER_DAY.
const firestoreAs = useRulesEnvironment();
const quiz = (as: string | null, day = ANSWERED_DAY) => doc(firestoreAs(as), `lists/L1/quizzes/${day}`);
const answer = (as: string | null, uid: string, day = ANSWERED_DAY) =>
  doc(firestoreAs(as), `lists/L1/quizzes/${day}/answers/${uid}`);
const answersOf = (as: string | null, day = ANSWERED_DAY) =>
  collection(firestoreAs(as), `lists/L1/quizzes/${day}/answers`);
const quizKey = (as: string | null) => doc(firestoreAs(as), `lists/L1/quizKeys/${ANSWERED_DAY}`);
const newAnswer = () => ({ optionId: 'b', correct: false, answeredAt: serverTimestamp() });

describe('quizzes: membros leem, só o backend grava', () => {
  test('membro lê o quiz do dia', () => allows(getDoc(quiz(MEMBER))));
  test('membro lista os quizzes', () => allows(getDocs(collection(firestoreAs(MEMBER), 'lists/L1/quizzes'))));
  test('quem não é membro lê o quiz do dia', () => denies(getDoc(quiz(OUTSIDER))));
  test('quem não é membro lista os quizzes', () =>
    denies(getDocs(collection(firestoreAs(OUTSIDER), 'lists/L1/quizzes'))));
  test('membro cria um quiz', () => denies(setDoc(quiz(MEMBER, '2026-10-19'), { day: '2026-10-19' })));
  test('membro regrava o quiz do dia', () => denies(setDoc(quiz(MEMBER), { day: ANSWERED_DAY })));
  test('membro apaga o quiz do dia', () => denies(deleteDoc(quiz(MEMBER))));
});

describe('quizzes/answers: leitura só depois da própria resposta', () => {
  test('quem já respondeu lê a resposta de outra pessoa', () => allows(getDoc(answer(OWNER, OUTSIDER))));
  test('quem já respondeu lê a própria resposta', () => allows(getDoc(answer(OWNER, OWNER))));
  test('quem já respondeu lista as respostas do dia', () => allows(getDocs(answersOf(OWNER))));
  test('integrante lista as respostas do dia que respondeu', () => allows(getDocs(answersOf(MEMBER, OTHER_DAY))));
  test('quem ainda não respondeu lê a resposta da outra pessoa', () => denies(getDoc(answer(MEMBER, OWNER))));
  test('quem ainda não respondeu lista as respostas do dia (ter respondido outro dia não libera)', () =>
    denies(getDocs(answersOf(MEMBER))));
  test('dona, sem resposta no outro dia, lê a resposta da integrante nele', () =>
    denies(getDoc(answer(OWNER, MEMBER, OTHER_DAY))));
  test('quem saiu da lista e tem resposta guardada lista as respostas', () => denies(getDocs(answersOf(OUTSIDER))));
  test('sem login lista as respostas', () => denies(getDocs(answersOf(null))));
});

describe('quizzes/answers: só o backend grava', () => {
  test('membro grava a própria resposta', () => denies(setDoc(answer(MEMBER, MEMBER), newAnswer())));
  test('quem já respondeu regrava a própria resposta', () => denies(setDoc(answer(OWNER, OWNER), newAnswer())));
  test('membro grava resposta em nome de outra pessoa', () => denies(setDoc(answer(OWNER, MEMBER), newAnswer())));
  test('quem já respondeu apaga a própria resposta', () => denies(deleteDoc(answer(OWNER, OWNER))));
});

describe('quizKeys: ninguém pelo app', () => {
  test('membro lê o gabarito', () => denies(getDoc(quizKey(MEMBER))));
  test('quem já respondeu lê o gabarito', () => denies(getDoc(quizKey(OWNER))));
  test('membro lista os gabaritos', () => denies(getDocs(collection(firestoreAs(MEMBER), 'lists/L1/quizKeys'))));
  test('membro grava um gabarito', () => denies(setDoc(quizKey(MEMBER), { rightOptionId: 'b', explanation: 'e' })));
});

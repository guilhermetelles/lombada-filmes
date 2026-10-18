import { describe, test } from 'node:test';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { allows, denies } from './support/expectations.js';
import { useRulesEnvironment } from './support/rules-environment.js';
import { MEMBER, OUTSIDER, OWNER, PAST } from './support/samples.js';

const firestoreAs = useRulesEnvironment();
const dismissed = (as: string | null, tmdbId = '27205') => doc(firestoreAs(as), `lists/L1/dismissed/${tmdbId}`);
const existingDismissed = (as: string | null) => dismissed(as, '550');
const dismissal = (uid: string, overrides: Record<string, unknown> = {}) => ({
  by: uid,
  at: serverTimestamp(),
  ...overrides,
});
const dismissAsMember = (overrides: Record<string, unknown> = {}, tmdbId = '27205') =>
  setDoc(dismissed(MEMBER, tmdbId), dismissal(MEMBER, overrides));

describe('dismissed: criação', () => {
  test('membro dispensa uma sugestão', () => allows(dismissAsMember()));
  test('quem não é membro dispensa', () => denies(setDoc(dismissed(OUTSIDER), dismissal(OUTSIDER))));
  test('sem login dispensa', () => denies(setDoc(dismissed(null), dismissal(MEMBER))));
  test('dispensa em nome de outra pessoa (by)', () => denies(dismissAsMember({ by: OWNER })));
  test('at no passado', () => denies(dismissAsMember({ at: PAST })));
  test('sem at', () => denies(setDoc(dismissed(MEMBER), { by: MEMBER })));
  test('campo extra', () => denies(dismissAsMember({ reason: 'chato' })));
  test('id que não é número', () => denies(dismissAsMember({}, 'abc')));
  test('id começando com zero', () => denies(dismissAsMember({}, '0550')));
  test('id com 9 dígitos', () => denies(dismissAsMember({}, '123456789')));
});

describe('dismissed: edição e exclusão', () => {
  test('membro regrava uma já dispensada', () => denies(setDoc(existingDismissed(MEMBER), dismissal(MEMBER))));
  test('membro muda by', () => denies(updateDoc(existingDismissed(MEMBER), { by: MEMBER })));
  test('membro desfaz a dispensa', () => allows(deleteDoc(existingDismissed(MEMBER))));
  test('quem não é membro desfaz a dispensa', () => denies(deleteDoc(existingDismissed(OUTSIDER))));
});

describe('dismissed: leitura', () => {
  test('membro lê uma dispensada', () => allows(getDoc(existingDismissed(MEMBER))));
  test('membro lista as dispensadas', () => allows(getDocs(collection(firestoreAs(MEMBER), 'lists/L1/dismissed'))));
  test('quem não é membro lista as dispensadas', () =>
    denies(getDocs(collection(firestoreAs(OUTSIDER), 'lists/L1/dismissed'))));
});

import { describe, test } from 'node:test';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { allows, denies } from './support/expectations.js';
import { useRulesEnvironment } from './support/rules-environment.js';
import { MEMBER, OUTSIDER } from './support/samples.js';

const firestoreAs = useRulesEnvironment();

/** Documentos de L1 que só o backend grava e que os membros leem. */
const generated = [
  { collectionPath: 'lists/L1/recs', id: 'current' },
  { collectionPath: 'lists/L1/feed', id: 'f1' },
  { collectionPath: 'lists/L1/scores', id: '2026-09' },
  { collectionPath: 'lists/L1/retros', id: '2026-09' },
];

for (const { collectionPath, id } of generated) {
  const stored = (as: string | null, docId = id) => doc(firestoreAs(as), `${collectionPath}/${docId}`);

  describe(`${collectionPath}: membros leem, só o backend grava`, () => {
    test('membro lê', () => allows(getDoc(stored(MEMBER))));
    test('membro lista a coleção', () => allows(getDocs(collection(firestoreAs(MEMBER), collectionPath))));
    test('quem não é membro lê', () => denies(getDoc(stored(OUTSIDER))));
    test('quem não é membro lista a coleção', () => denies(getDocs(collection(firestoreAs(OUTSIDER), collectionPath))));
    test('sem login lê', () => denies(getDoc(stored(null))));
    test('membro regrava', () => denies(setDoc(stored(MEMBER), { title: 'x' })));
    test('membro cria outro documento', () => denies(setDoc(stored(MEMBER, 'novo'), { title: 'x' })));
    test('membro apaga', () => denies(deleteDoc(stored(MEMBER))));
  });
}

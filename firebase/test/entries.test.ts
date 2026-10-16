import { describe, test } from 'node:test';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { allows, denies } from './support/expectations.js';
import { useRulesEnvironment } from './support/rules-environment.js';
import { editedBy, MEMBER, movieSnapshot, newEntry, OUTSIDER, OWNER, PAST } from './support/samples.js';

const firestoreAs = useRulesEnvironment();
const entry = (as: string | null, entryId = 'e2') => doc(firestoreAs(as), `lists/L1/entries/${entryId}`);
const existingEntry = (as: string | null) => entry(as, 'e1');
const addAsMember = (overrides: Record<string, unknown> = {}) => setDoc(entry(MEMBER), newEntry(MEMBER, overrides));
const editAsMember = (fields: Record<string, unknown>) =>
  updateDoc(existingEntry(MEMBER), { ...fields, ...editedBy(MEMBER) });
const entriesOf = (as: string | null) => collection(firestoreAs(as), 'lists/L1/entries');

describe('entries: criação', () => {
  test('membro adiciona filme', () => allows(addAsMember()));
  test('filme sem data (watchedOn null)', () => allows(addAsMember({ watchedOn: null })));
  test('quem não é membro adiciona filme', () => denies(setDoc(entry(OUTSIDER), newEntry(OUTSIDER))));
  test('sem login adiciona filme', () => denies(setDoc(entry(null), newEntry(OWNER))));
  test('cria em nome de outra pessoa (addedBy)', () => denies(addAsMember({ addedBy: OWNER })));
  test('cria com updatedBy de outra pessoa', () => denies(addAsMember({ updatedBy: OWNER })));
  test('comentário com 5001 caracteres', () => denies(addAsMember({ comment: 'x'.repeat(5001) })));
  test('data inválida 2026-13-01', () => denies(addAsMember({ watchedOn: '2026-13-01' })));
  test('data como timestamp', () => denies(addAsMember({ watchedOn: PAST })));
  test('tmdbId como texto', () => denies(addAsMember({ tmdbId: '2756' })));
  test('tmdbId negativo', () => denies(addAsMember({ tmdbId: -1 })));
  test('rankKey com caracteres inválidos', () => denies(addAsMember({ rankKey: 'a0/../x' })));
  test('cópia do filme com campo extra', () => denies(addAsMember({ movie: { ...movieSnapshot, hack: 1 } })));
  test('nota do IMDb 11', () => denies(addAsMember({ movie: { ...movieSnapshot, imdb: 11 } })));
  test('título do filme com 1 MB', () =>
    denies(addAsMember({ movie: { ...movieSnapshot, title: 'x'.repeat(1_000_000) } })));
  test('createdAt no passado', () => denies(addAsMember({ createdAt: PAST })));
  test('campo extra', () => denies(addAsMember({ extraData: 'x' })));
  test('lista que não existe', () =>
    denies(setDoc(doc(firestoreAs(MEMBER), 'lists/NOPE/entries/e9'), newEntry(MEMBER))));
});

describe('entries: edição', () => {
  test('membro reordena filme de outra pessoa (rankKey)', () => allows(editAsMember({ rankKey: 'a0V' })));
  test('membro edita comentário e data', () => allows(editAsMember({ comment: 'Mudou', watchedOn: null })));
  test('edição sem marcar updatedBy de quem editou', () =>
    denies(updateDoc(existingEntry(MEMBER), { rankKey: 'a1', updatedAt: editedBy(MEMBER).updatedAt })));
  test('troca o filme (tmdbId)', () => denies(editAsMember({ tmdbId: 1 })));
  test('altera a cópia do filme', () => denies(editAsMember({ movie: { ...movieSnapshot, imdb: 10 } })));
  test('troca addedBy', () => denies(editAsMember({ addedBy: MEMBER })));
  test('apaga um campo obrigatório', () =>
    denies(
      setDoc(existingEntry(MEMBER), {
        tmdbId: 2756,
        rankKey: 'a0',
        addedBy: OWNER,
        createdAt: PAST,
        movie: movieSnapshot,
        ...editedBy(MEMBER),
      }),
    ));
  test('comentário de 1 MB', () => denies(editAsMember({ comment: 'x'.repeat(1_000_000) })));
  test('quem não é membro reordena', () =>
    denies(updateDoc(existingEntry(OUTSIDER), { rankKey: 'b', ...editedBy(OUTSIDER) })));
});

describe('entries: leitura e exclusão', () => {
  test('membro lista as entradas por rankKey', () => allows(getDocs(query(entriesOf(MEMBER), orderBy('rankKey')))));
  test('membro lista as entradas por data', () =>
    allows(getDocs(query(entriesOf(MEMBER), orderBy('watchedOn', 'desc')))));
  test('quem não é membro lista as entradas', () => denies(getDocs(entriesOf(OUTSIDER))));
  test('membro remove filme', () => allows(deleteDoc(existingEntry(MEMBER))));
  test('quem não é membro remove filme', () => denies(deleteDoc(existingEntry(OUTSIDER))));
});

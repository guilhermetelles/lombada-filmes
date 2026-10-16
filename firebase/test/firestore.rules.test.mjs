// Testes das regras do Lombada no emulador do Firestore (projeto demo-, nada toca o lombada-db).
//
// Como rodar, de dentro de firebase/ (precisa de Java 11+ no PATH para o emulador):
//   npm i --no-save @firebase/rules-unit-testing@4 firebase@11
//   npx firebase-tools emulators:exec --only firestore --project demo-lombada "node test/firestore.rules.test.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, getDocs,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-lombada',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});

const A = 'uidA', B = 'uidB', C = 'uidC';
const db = uid => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const past = Timestamp.fromDate(new Date('2020-01-01'));

const movie = { title: 'The Abyss', year: 1989, posterPath: '/kRP5.jpg', imdb: 7.5, letterboxd: 3.72 };
const entry = (by, extra = {}) => ({
  tmdbId: 2756, rankKey: 'a0', watchedOn: '2025-10-12', comment: 'ESSE FILME É INCRÍVEL',
  addedBy: by, updatedBy: by, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), movie, ...extra,
});
const user = (extra = {}) => ({
  displayName: 'Guilherme', photoUrl: 'https://example.com/a.png', recentListIds: 'L1', activeListId: 'L1',
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});
const list = (owner, extra = {}) => ({
  name: 'Maratona', description: '', ownerUid: owner, memberUids: [owner],
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'users/uidA'), { ...user(), createdAt: past, updatedAt: past });
    await setDoc(doc(f, 'lists/L1'), { name: 'Competição de filmes terríveis', description: 'Os filmes que vimos', ownerUid: A, memberUids: [A, B], createdAt: past, updatedAt: past });
    await setDoc(doc(f, 'lists/L1/entries/e1'), { ...entry(A), createdAt: past, updatedAt: past });
    await setDoc(doc(f, 'invites/7Q4KMX'), { listId: 'L1', createdBy: A, expiresAt: past, usedBy: [] });
    await setDoc(doc(f, 'movies/2756'), { title: 'The Abyss' });
    await setDoc(doc(f, 'usage/2026-10-16'), { omdb: { calls: 97 } });
  });
}

const results = [];
async function t(name, expect, fn) {
  await seed();
  try {
    await (expect === 'ok' ? assertSucceeds(fn()) : assertFails(fn()));
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FALHOU', `${name}  (esperado: ${expect === 'ok' ? 'permitir' : 'negar'})  ${String(e.message || e).split('\n')[0]}`]);
  }
}

// ---------- users ----------
await t('users: C cria o próprio perfil válido', 'ok', () => setDoc(doc(db(C), 'users/uidC'), user()));
await t('users: C cria perfil sem listas visitadas', 'ok', () => setDoc(doc(db(C), 'users/uidC'), user({ recentListIds: '', activeListId: null })));
await t('users: A lê o perfil de B', 'deny', () => getDoc(doc(db(A), 'users/uidB')));
await t('users: sem login lê perfil', 'deny', () => getDoc(doc(db(null), 'users/uidA')));
await t('users: A cria perfil com campo extra isAdmin', 'deny', () => setDoc(doc(db(A), 'users/uidA'), user({ isAdmin: true })));
await t('users: A cria perfil para B', 'deny', () => setDoc(doc(db(A), 'users/uidB'), user()));
await t('users: A muda createdAt', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
await t('users: A atualiza listas visitadas', 'ok', () => updateDoc(doc(db(A), 'users/uidA'), { recentListIds: 'L2,L1', activeListId: 'L2', updatedAt: serverTimestamp() }));
await t('users: recentListIds com id gigante', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { recentListIds: 'x'.repeat(100000), updatedAt: serverTimestamp() }));
await t('users: recentListIds como lista em vez de texto', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { recentListIds: ['L1', 42], updatedAt: serverTimestamp() }));
await t('users: recentListIds repetidos', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { recentListIds: 'L1,L1', updatedAt: serverTimestamp() }));
await t('users: recentListIds com 201 ids', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { recentListIds: Array.from({ length: 201 }, (_, i) => `L${i}`).join(','), updatedAt: serverTimestamp() }));
await t('users: recentListIds com caractere inválido', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { recentListIds: 'L1,../x', updatedAt: serverTimestamp() }));
await t('users: recentListIds com vírgula sobrando', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { recentListIds: 'L1,', updatedAt: serverTimestamp() }));
await t('users: A apaga o próprio perfil', 'ok', () => deleteDoc(doc(db(A), 'users/uidA')));
await t('users: B apaga o perfil de A', 'deny', () => deleteDoc(doc(db(B), 'users/uidA')));
await t('users: displayName com 81 caracteres', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { displayName: 'x'.repeat(81), updatedAt: serverTimestamp() }));
await t('users: updatedAt no passado', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { displayName: 'G', updatedAt: past }));
await t('users: photoUrl javascript:', 'deny', () => updateDoc(doc(db(A), 'users/uidA'), { photoUrl: 'javascript:alert(1)', updatedAt: serverTimestamp() }));

// ---------- lists ----------
await t('lists: A cria lista válida', 'ok', () => setDoc(doc(db(A), 'lists/L2'), list(A)));
await t('lists: A cria lista já incluindo C como membro', 'deny', () => setDoc(doc(db(A), 'lists/L2'), list(A, { memberUids: [A, C] })));
await t('lists: A cria lista em nome de B', 'deny', () => setDoc(doc(db(A), 'lists/L2'), list(B, { memberUids: [A] })));
await t('lists: A cria lista com source', 'deny', () => setDoc(doc(db(A), 'lists/L2'), list(A, { source: { letterboxdUrl: 'https://boxd.it/x' } })));
await t('lists: A cria lista com nome vazio (só espaços)', 'deny', () => setDoc(doc(db(A), 'lists/L2'), list(A, { name: '   ' })));
await t('lists: sem login cria lista', 'deny', () => setDoc(doc(db(null), 'lists/L2'), list(A)));
await t('lists: membro B lê a lista', 'ok', () => getDoc(doc(db(B), 'lists/L1')));
await t('lists: não membro C lê a lista', 'deny', () => getDoc(doc(db(C), 'lists/L1')));
await t('lists: C consulta "minhas listas" (array-contains)', 'ok', () => getDocs(query(collection(db(C), 'lists'), where('memberUids', 'array-contains', C))));
await t('lists: C consulta todas as listas sem filtro', 'deny', () => getDocs(collection(db(C), 'lists')));
await t('lists: membro B edita nome e descrição', 'ok', () => updateDoc(doc(db(B), 'lists/L1'), { name: 'Novo nome', description: 'Nova', updatedAt: serverTimestamp() }));
await t('lists: membro B se dá dono', 'deny', () => updateDoc(doc(db(B), 'lists/L1'), { ownerUid: B, updatedAt: serverTimestamp() }));
await t('lists: membro B adiciona C em memberUids', 'deny', () => updateDoc(doc(db(B), 'lists/L1'), { memberUids: [A, B, C], updatedAt: serverTimestamp() }));
await t('lists: membro B remove A de memberUids', 'deny', () => updateDoc(doc(db(B), 'lists/L1'), { memberUids: [B], updatedAt: serverTimestamp() }));
await t('lists: C se adiciona em memberUids', 'deny', () => updateDoc(doc(db(C), 'lists/L1'), { memberUids: [A, B, C], updatedAt: serverTimestamp() }));
await t('lists: nome curto seguido de 1 MB de espaços', 'deny', () => updateDoc(doc(db(B), 'lists/L1'), { name: 'a' + ' '.repeat(1000000), updatedAt: serverTimestamp() }));
await t('lists: descrição com 281 caracteres', 'deny', () => updateDoc(doc(db(B), 'lists/L1'), { description: 'x'.repeat(281), updatedAt: serverTimestamp() }));
await t('lists: nome com 1000 caracteres', 'deny', () => updateDoc(doc(db(B), 'lists/L1'), { name: 'x'.repeat(1000), updatedAt: serverTimestamp() }));
await t('lists: campo extra', 'deny', () => updateDoc(doc(db(B), 'lists/L1'), { hacked: true, updatedAt: serverTimestamp() }));
await t('lists: muda createdAt', 'deny', () => updateDoc(doc(db(B), 'lists/L1'), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
await t('lists: dono A exclui a lista', 'deny', () => deleteDoc(doc(db(A), 'lists/L1')));

// ---------- entries ----------
const E = (uid, id = 'e2') => doc(db(uid), `lists/L1/entries/${id}`);
await t('entries: membro B adiciona filme', 'ok', () => setDoc(E(B), entry(B)));
await t('entries: filme sem data (watchedOn null)', 'ok', () => setDoc(E(B), entry(B, { watchedOn: null })));
await t('entries: não membro C adiciona filme', 'deny', () => setDoc(E(C), entry(C)));
await t('entries: sem login adiciona filme', 'deny', () => setDoc(doc(db(null), 'lists/L1/entries/e2'), entry(A)));
await t('entries: B cria em nome de A (addedBy)', 'deny', () => setDoc(E(B), entry(B, { addedBy: A })));
await t('entries: B cria com updatedBy de A', 'deny', () => setDoc(E(B), entry(B, { updatedBy: A })));
await t('entries: comentário com 5001 caracteres', 'deny', () => setDoc(E(B), entry(B, { comment: 'x'.repeat(5001) })));
await t('entries: data inválida 2026-13-01', 'deny', () => setDoc(E(B), entry(B, { watchedOn: '2026-13-01' })));
await t('entries: data como timestamp', 'deny', () => setDoc(E(B), entry(B, { watchedOn: past })));
await t('entries: tmdbId como texto', 'deny', () => setDoc(E(B), entry(B, { tmdbId: '2756' })));
await t('entries: tmdbId negativo', 'deny', () => setDoc(E(B), entry(B, { tmdbId: -1 })));
await t('entries: rankKey com caracteres inválidos', 'deny', () => setDoc(E(B), entry(B, { rankKey: 'a0/../x' })));
await t('entries: cópia do filme com campo extra', 'deny', () => setDoc(E(B), entry(B, { movie: { ...movie, hack: 1 } })));
await t('entries: nota IMDb 11', 'deny', () => setDoc(E(B), entry(B, { movie: { ...movie, imdb: 11 } })));
await t('entries: título do filme com 1 MB', 'deny', () => setDoc(E(B), entry(B, { movie: { ...movie, title: 'x'.repeat(1000000) } })));
await t('entries: createdAt no passado', 'deny', () => setDoc(E(B), entry(B, { createdAt: past })));
await t('entries: campo extra', 'deny', () => setDoc(E(B), entry(B, { extraData: 'x' })));
await t('entries: lista que não existe', 'deny', () => setDoc(doc(db(B), 'lists/NOPE/entries/e9'), entry(B)));
await t('entries: B reordena filme de A (rankKey)', 'ok', () => updateDoc(E(B, 'e1'), { rankKey: 'a0V', updatedBy: B, updatedAt: serverTimestamp() }));
await t('entries: B edita comentário e data', 'ok', () => updateDoc(E(B, 'e1'), { comment: 'Mudou', watchedOn: null, updatedBy: B, updatedAt: serverTimestamp() }));
await t('entries: update sem marcar updatedBy de quem editou', 'deny', () => updateDoc(E(B, 'e1'), { rankKey: 'a1', updatedAt: serverTimestamp() }));
await t('entries: B troca o filme (tmdbId)', 'deny', () => updateDoc(E(B, 'e1'), { tmdbId: 1, updatedBy: B, updatedAt: serverTimestamp() }));
await t('entries: B altera a cópia do filme', 'deny', () => updateDoc(E(B, 'e1'), { movie: { ...movie, imdb: 10 }, updatedBy: B, updatedAt: serverTimestamp() }));
await t('entries: B troca addedBy', 'deny', () => updateDoc(E(B, 'e1'), { addedBy: B, updatedBy: B, updatedAt: serverTimestamp() }));
await t('entries: update apagando campo obrigatório', 'deny', () => setDoc(E(B, 'e1'), { tmdbId: 2756, rankKey: 'a0', addedBy: A, updatedBy: B, createdAt: past, updatedAt: serverTimestamp(), movie }));
await t('entries: update com comentário de 1 MB', 'deny', () => updateDoc(E(B, 'e1'), { comment: 'x'.repeat(1000000), updatedBy: B, updatedAt: serverTimestamp() }));
await t('entries: C reordena', 'deny', () => updateDoc(E(C, 'e1'), { rankKey: 'b', updatedBy: C, updatedAt: serverTimestamp() }));
await t('entries: B lista entradas ordenadas por rankKey', 'ok', () => getDocs(query(collection(db(B), 'lists/L1/entries'), orderBy('rankKey'))));
await t('entries: B lista entradas ordenadas por data', 'ok', () => getDocs(query(collection(db(B), 'lists/L1/entries'), orderBy('watchedOn', 'desc'))));
await t('entries: C lista entradas', 'deny', () => getDocs(collection(db(C), 'lists/L1/entries')));
await t('entries: B remove filme', 'ok', () => deleteDoc(E(B, 'e1')));
await t('entries: C remove filme', 'deny', () => deleteDoc(E(C, 'e1')));

// ---------- invites, movies, usage ----------
await t('invites: membro lê código', 'deny', () => getDoc(doc(db(B), 'invites/7Q4KMX')));
await t('invites: alguém lista códigos', 'deny', () => getDocs(collection(db(C), 'invites')));
await t('invites: alguém cria código', 'deny', () => setDoc(doc(db(C), 'invites/AAAAAA'), { listId: 'L1' }));
await t('movies: logado lê filme', 'ok', () => getDoc(doc(db(C), 'movies/2756')));
await t('movies: sem login lê filme', 'deny', () => getDoc(doc(db(null), 'movies/2756')));
await t('movies: logado grava filme', 'deny', () => setDoc(doc(db(B), 'movies/2756'), { title: 'x' }));
await t('usage: logado lê consumo', 'ok', () => getDoc(doc(db(B), 'usage/2026-10-16')));
await t('usage: logado grava consumo', 'deny', () => setDoc(doc(db(B), 'usage/2026-10-16'), { omdb: { calls: 0 } }));
await t('outra coleção qualquer', 'deny', () => setDoc(doc(db(B), 'segredos/x'), { a: 1 }));

await env.cleanup();
const failed = results.filter(r => r[0] !== 'PASS');
for (const r of results) console.log(r[0].padEnd(6), r[1]);
console.log(`\n${results.length - failed.length}/${results.length} passaram`);
process.exit(failed.length ? 1 : 0);

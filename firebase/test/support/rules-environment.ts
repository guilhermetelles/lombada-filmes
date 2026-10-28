import { readFileSync } from 'node:fs';
import { after, before, beforeEach } from 'node:test';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, type Firestore, setDoc } from 'firebase/firestore';
import { ANSWERED_DAY, MEMBER, OTHER_DAY, OUTSIDER, OWNER, PAST, storedEntry, storedUser } from './samples.js';

/** Regras testadas: as mesmas publicadas no lombada-db. */
const RULES_PATH = new URL('../../firestore.rules', import.meta.url);

/**
 * Sobe o ambiente de testes das regras para o arquivo de teste atual e repõe os dados de exemplo
 * antes de cada caso.
 *
 * @returns Função que dá o Firestore de uma pessoa, ou de ninguém logado com null.
 */
export function useRulesEnvironment(): (uid: string | null) => Firestore {
  let environment: RulesTestEnvironment | undefined;

  before(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'demo-lombada',
      firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: '127.0.0.1', port: 8080 },
    });
  });

  beforeEach(async () => {
    const current = requireEnvironment(environment);
    await current.clearFirestore();
    await current.withSecurityRulesDisabled(async (context) => seed(asModularFirestore(context.firestore())));
  });

  after(async () => {
    await environment?.cleanup();
  });

  return (uid) => {
    const current = requireEnvironment(environment);
    const context = uid ? current.authenticatedContext(uid) : current.unauthenticatedContext();
    return asModularFirestore(context.firestore());
  };
}

/**
 * Grava os dados de partida: a lista L1 da dona com uma integrante, uma entrada, um convite, um
 * filme, o consumo, a lista LP com memberProfiles, os documentos que o backend gera dentro de L1
 * (fila, dispensadas, sugestões, feed, quiz, respostas, gabarito, placar, retrospectiva, duelo) e os de
 * notificação.
 *
 * @param db - Firestore com as regras desligadas.
 */
async function seed(db: Firestore): Promise<void> {
  await setDoc(doc(db, `users/${OWNER}`), storedUser());
  await setDoc(doc(db, 'lists/L1'), {
    name: 'Competição de filmes terríveis',
    description: 'Os filmes que vimos',
    ownerUid: OWNER,
    memberUids: [OWNER, MEMBER],
    createdAt: PAST,
    updatedAt: PAST,
  });
  await setDoc(doc(db, 'lists/L1/entries/e1'), storedEntry(OWNER));
  await setDoc(doc(db, 'invites/7Q4KMX'), { listId: 'L1', createdBy: OWNER, expiresAt: PAST, usedBy: [] });
  await setDoc(doc(db, 'movies/2756'), { title: 'The Abyss' });
  await setDoc(doc(db, 'people/2710'), { name: 'James Cameron' });
  await setDoc(doc(db, 'usage/2026-10-16'), { omdb: { calls: 97 } });
  await setDoc(doc(db, `users/${MEMBER}`), { ...storedUser(), feedSeenAt: { L1: PAST } });
  await setDoc(doc(db, 'lists/LP'), {
    name: 'Com perfis',
    description: '',
    ownerUid: OWNER,
    memberUids: [OWNER, MEMBER],
    memberProfiles: {
      [OWNER]: { name: 'Dona', photoUrl: null },
      [MEMBER]: { name: 'Integrante', photoUrl: 'https://example.com/b.png' },
    },
    createdAt: PAST,
    updatedAt: PAST,
  });
  await seedGenerated(db);
  await setDoc(doc(db, `devices/${OWNER}/tokens/abc123`), { token: 't', platform: 'android', updatedAt: PAST });
  await setDoc(doc(db, `notifyState/${OWNER}`), { prefs: { freq: 3, hour: 19 } });
  await setDoc(doc(db, `notifyLog/${OWNER}_${ANSWERED_DAY}`), { type: 'daily.quiz', listId: 'L1', sentAt: PAST });
}

/**
 * Grava em L1 o que só o backend escreve. No quiz de ANSWERED_DAY a dona e alguém de fora (que já
 * saiu da lista) responderam e a integrante não; a integrante só respondeu o de OTHER_DAY.
 *
 * @param db - Firestore com as regras desligadas.
 */
async function seedGenerated(db: Firestore): Promise<void> {
  const answer = { optionId: 'a', correct: true, answeredAt: PAST };
  await setDoc(doc(db, 'lists/L1/queue/603'), { tmdbId: 603, addedBy: OWNER, createdAt: PAST });
  await setDoc(doc(db, 'lists/L1/dismissed/550'), { by: OWNER, at: PAST });
  await setDoc(doc(db, 'lists/L1/recs/current'), { computedAt: PAST, modelVersion: 'v1', items: [], trending: [] });
  await setDoc(doc(db, 'lists/L1/feed/f1'), {
    type: 'queue.added',
    kind: 'lista',
    createdAt: PAST,
    title: 't',
    route: { name: 'queue' },
  });
  await setDoc(doc(db, `lists/L1/quizzes/${ANSWERED_DAY}`), { day: ANSWERED_DAY, type: 'ano', prompt: 'p' });
  await setDoc(doc(db, `lists/L1/quizzes/${ANSWERED_DAY}/answers/${OWNER}`), answer);
  await setDoc(doc(db, `lists/L1/quizzes/${ANSWERED_DAY}/answers/${OUTSIDER}`), answer);
  await setDoc(doc(db, `lists/L1/quizzes/${OTHER_DAY}`), { day: OTHER_DAY, type: 'ano', prompt: 'p' });
  await setDoc(doc(db, `lists/L1/quizzes/${OTHER_DAY}/answers/${MEMBER}`), answer);
  await setDoc(doc(db, `lists/L1/quizKeys/${ANSWERED_DAY}`), { rightOptionId: 'a', explanation: 'e' });
  await setDoc(doc(db, 'lists/L1/scores/2026-09'), { points: { [OWNER]: 3, [MEMBER]: 2 }, winnerUids: [OWNER] });
  await setDoc(doc(db, 'lists/L1/retros/2026-09'), { month: '2026-09', films: 4, minutes: 400, generatedAt: PAST });
  await setDoc(doc(db, 'lists/L1/duels/2026-09-30'), {
    day: '2026-09-30',
    entryIdA: 'e1',
    entryIdB: 'e2',
    votes: {},
    status: 'open',
  });
}

/**
 * Garante que o ambiente já subiu.
 *
 * @param environment - Ambiente criado no before.
 * @returns O ambiente.
 * @throws {Error} Se for usado antes do before.
 */
function requireEnvironment(environment: RulesTestEnvironment | undefined): RulesTestEnvironment {
  if (!environment) throw new Error('ambiente de regras ainda não iniciado');
  return environment;
}

/**
 * A biblioteca de testes devolve o Firestore no tipo da API antiga (compat), mas o objeto funciona
 * com as funções modulares (doc, setDoc…), que são as que o app usa.
 *
 * @param firestore - Firestore devolvido pelo contexto de teste.
 * @returns O mesmo objeto, com o tipo da API modular.
 */
function asModularFirestore(firestore: unknown): Firestore {
  return firestore as Firestore;
}

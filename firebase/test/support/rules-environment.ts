import { readFileSync } from 'node:fs';
import { after, before, beforeEach } from 'node:test';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, type Firestore, setDoc } from 'firebase/firestore';
import { MEMBER, OWNER, PAST, storedEntry, storedUser } from './samples.js';

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
 * filme e o consumo.
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

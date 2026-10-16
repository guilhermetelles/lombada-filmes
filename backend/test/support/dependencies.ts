import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseApp } from '../../lib/config/firebase-app.js';
import { createSourceClients } from '../../lib/sources/create-source-clients.js';
import type { Dependencies } from '../../lib/types/dependencies.js';
import type { Fetch } from '../../lib/types/sources.js';
import { emulatorProject, firestoreEmulatorHost } from './emulators.js';

const TEST_CREDENTIALS = { tmdbToken: 'token-de-teste', omdbKey: 'chave-de-teste' };

/** Segredo do cron nos testes. */
export const TEST_CRON_SECRET = 'segredo-do-cron-de-teste';

/**
 * Monta dependências reais (Admin SDK nos emuladores e os clientes de verdade), trocando só o fetch
 * e o relógio.
 *
 * @param fetch - fetch falso das fontes (fakeSources ou respondWith).
 * @param now - Relógio controlado pelo teste.
 * @returns Dependências prontas para passar a uma rota.
 */
function createTestDependencies(fetch: Fetch, now: () => Date = () => new Date()): Dependencies {
  const app = getFirebaseApp({ FIRESTORE_EMULATOR_HOST: firestoreEmulatorHost, GCLOUD_PROJECT: emulatorProject });
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    sources: createSourceClients(TEST_CREDENTIALS, fetch),
    now,
    cronSecret: TEST_CRON_SECRET,
  };
}

export { createTestDependencies };
